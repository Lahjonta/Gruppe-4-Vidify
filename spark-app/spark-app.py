from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import IntegerType, StringType, StructType, TimestampType

import mysql.connector

_DB_OPTIONS = {
    "host": "my-app-mariadb-service",
    'port': 3306,
    "user": "root",
    "password": "mysecretpw",
    'database': 'popular',
}


windowDuration = '1 minute'
slidingDuration = '1 minute'

# Example Part 1
# Create a spark session
spark = SparkSession.builder \
    .appName("Use Case").getOrCreate()

# Set log level
spark.sparkContext.setLogLevel('WARN')

# Example Part 2
# Read messages from Kafka
kafkaMessages = spark \
    .readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers",
            "my-cluster-kafka-bootstrap:9092") \
    .option("subscribe", "tracking-data") \
    .option("startingOffsets", "earliest") \
    .load()

# Define schema of tracking data
trackingMessageSchema = StructType() \
    .add("song", StringType()) \
    .add("timestamp", IntegerType())

# Example Part 3
# Convert value: binary -> JSON -> fields + parsed timestamp
trackingMessages = kafkaMessages.select(
    # Extract 'value' from Kafka message (i.e., the tracking data)
    from_json(
        column("value").cast("string"),
        trackingMessageSchema
    ).alias("json")
).select(
    # Convert Unix timestamp to TimestampType
    from_unixtime(column('json.timestamp'))
    .cast(TimestampType())
    .alias("parsed_timestamp"),

    # Select all JSON fields
    column("json.*")
) \
    .withColumnRenamed('json.song', 'song') \
    .withWatermark("parsed_timestamp", windowDuration)

# Example Part 4
# Compute most popular slides
popular = trackingMessages.groupBy(
    window(
        column("parsed_timestamp"),
        windowDuration,
        slidingDuration
    ),
    column("song")
).count() \
 .withColumnRenamed('window.start', 'window_end') \
 .withColumnRenamed('window.end', 'window_start') \

# Example Part 5
# Start running the query; print running counts to the console
consoleDump = popular \
    .writeStream \
    .outputMode("update") \
    .format("console") \
    .start()

# Example Part 6
def saveToDatabase(batchDataframe, batchId):
    # Define function to save a dataframe to mariadb
    def save_to_db(iterator):

        # Connect to database
        connection = mysql.connector.connect(**_DB_OPTIONS)
        cursor = connection.cursor()
        for row in iterator:
            song, count = row
            if song is None:
                continue

            # Run upsert (insert or update existing)
            upsert_statement = "INSERT INTO popular (song, count) VALUES (%s, %s) ON DUPLICATE KEY UPDATE count=%s"
            cursor.execute(upsert_statement, (song, count, count))
            connection.commit()

        connection.close()

    print(
        f"Writing batchID {batchId} to database @ {_DB_OPTIONS['host']}:{_DB_OPTIONS['port']}/{_DB_OPTIONS['database']}"
    )
    # Perform batch UPSERTS per data partition
    batchDataframe.foreachPartition(save_to_db)

# Example Part 7
dbInsertStream = popular \
    .select(column('song'), column('count')) \
    .writeStream \
    .outputMode("complete") \
    .foreachBatch(saveToDatabase) \
    .start()

# Wait for termination
spark.streams.awaitAnyTermination()
