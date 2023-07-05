const os = require('os')
const dns = require('dns').promises
const { program: optionparser } = require('commander')
const { Kafka } = require('kafkajs')
const mariadb = require('mariadb')
const MemcachePlus = require('memcache-plus')
const express = require('express')

const app = express()
const cacheTimeSecs = 15

// -------------------------------------------------------
// Command-line options (with sensible defaults)
// -------------------------------------------------------

let options = optionparser
	.storeOptionsAsProperties(true)
	// Web server
	.option('--port <port>', "Web server port", 3000)
	// Kafka options
	.option('--kafka-broker <host:port>', "Kafka bootstrap host:port", "my-cluster-kafka-bootstrap:9092")
	.option('--kafka-topic-tracking <topic>', "Kafka topic to tracking data send to", "tracking-data")
	.option('--kafka-client-id < id > ', "Kafka client ID", "tracker-" + Math.floor(Math.random() * 100000))
	// Memcached options
	.option('--memcached-hostname <hostname>', 'Memcached hostname (may resolve to multiple IPs)', 'my-memcached-service')
	.option('--memcached-port <port>', 'Memcached port', 11211)
	.option('--memcached-update-interval <ms>', 'Interval to query DNS for memcached IPs', 5000)
	// Database options
	.option('--mariadb-host <host>', 'MariaDB host', 'my-app-mariadb-service')
	.option('--mariadb-port <port>', 'MariaDB port', 3306)
	.option('--mariadb-schema <db>', 'MariaDB Schema/database', 'popular')
	.option('--mariadb-username <username>', 'MariaDB username', 'root')
	.option('--mariadb-password <password>', 'MariaDB password', 'mysecretpw')
	// Misc
	.addHelpCommand()
	.parse()
	.opts()

// -------------------------------------------------------
// Database Configuration
// -------------------------------------------------------

const pool = mariadb.createPool({
	host: options.mariadbHost,
	port: options.mariadbPort,
	database: options.mariadbSchema,
	user: options.mariadbUsername,
	password: options.mariadbPassword,
	connectionLimit: 5
})

async function executeQuery(query, data) {
	let connection
	try {
		connection = await pool.getConnection()
		console.log("Executing query ", query)
		let res = await connection.query({ rowsAsArray: true, sql: query }, data)
		return res
	} finally {
		if (connection)
			connection.end()
	}
}

// -------------------------------------------------------
// Memcache Configuration
// -------------------------------------------------------

//Connect to the memcached instances
let memcached = null
let memcachedServers = []

async function getMemcachedServersFromDns() {
	try {
		// Query all IP addresses for this hostname
		let queryResult = await dns.lookup(options.memcachedHostname, { all: true })

		// Create IP:Port mappings
		let servers = queryResult.map(el => el.address + ":" + options.memcachedPort)

		// Check if the list of servers has changed
		// and only create a new object if the server list has changed
		if (memcachedServers.sort().toString() !== servers.sort().toString()) {
			console.log("Updated memcached server list to ", servers)
			memcachedServers = servers

			//Disconnect an existing client
			if (memcached)
				await memcached.disconnect()

			memcached = new MemcachePlus(memcachedServers);
		}
	} catch (e) {
		console.log("Unable to get memcache servers (yet)")
	}
}

//Initially try to connect to the memcached servers, then each 5s update the list
getMemcachedServersFromDns()
setInterval(() => getMemcachedServersFromDns(), options.memcachedUpdateInterval)

//Get data from cache if a cache exists yet
async function getFromCache(key) {
	if (!memcached) {
		console.log(`No memcached instance available, memcachedServers = ${memcachedServers}`)
		return null;
	}
	return await memcached.get(key);
}

// -------------------------------------------------------
// Kafka Configuration
// -------------------------------------------------------

// Kafka connection
const kafka = new Kafka({
	clientId: options.kafkaClientId,
	brokers: [options.kafkaBroker],
	retry: {
		retries: 0
	}
})

const producer = kafka.producer()
// End

// Send tracking message to Kafka
async function sendTrackingMessage(data) {
	//Ensure the producer is connected
	await producer.connect()

	//Send message
	let result = await producer.send({
		topic: options.kafkaTopicTracking,
		messages: [
			{ value: JSON.stringify(data) }
		]
	})

	console.log("Send result:", result)
	return result
}
// End

// -------------------------------------------------------
// HTML helper to send a response to the client
// -------------------------------------------------------

function sendResponse(res, html, cachedResult) {
	res.send(`<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Vidify</title>
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/mini.css/3.0.1/mini-default.min.css">
			<script>
				function fetchRandomSongs() {
					const songs = ['Empty', 'Breezeblocks', 'The Adults Are Talking', 'Square Hammer', 'Circle With Me']
					const maxRepetitions = Math.floor(Math.random() * 200);
					document.getElementById("out").innerText = "Fetching " + maxRepetitions + " random songs, see console output";
			  
					for (var i = 0; i < maxRepetitions; ++i) {
				  		// Randomly choose a song from the available songs
				  		const randomSongIndex = Math.floor(Math.random() * songs.length);
						const randomSong = songs[randomSongIndex];
				  		console.log("Fetching random song: " + randomSong);
			  
				  		// Fetch the song using the randomly chosen index
						fetch("/songs/" + randomSong, { cache: 'no-cache' });
				}
			  }
			  
			</script>
		</head>
		<body>
			<h1>Vidify</h1>
			<p>
				<a href="javascript: fetchRandomSongs();">Randomly fetch some songs</a>
				<span id="out"></span>
			</p>
			${html}
			<hr>
			<h2>Information about the generated page</h4>
			<ul>
				<li>Server: ${os.hostname()}</li>
				<li>Date: ${new Date()}</li>
				<li>Using ${memcachedServers.length} memcached Servers: ${memcachedServers}</li>
				<li>Cached result: ${cachedResult}</li>
			</ul>
		</body>
	</html>
	`)
}

// -------------------------------------------------------
// Start page
// -------------------------------------------------------

// Get list of songs (from cache or db)
async function getsongs() {
	const key = 'songs'
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, cachedata = `, cachedata)
		return { result: cachedata, cached: true }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)
		const data = await executeQuery("SELECT song FROM songs", [])
		if (data) {
			let result = data.map(row => row?.[0])
			console.log("Got result=", result, "storing in cache")
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { result, cached: false }
		} else {
			throw "No songs data found"
		}
	}
}

// Get popular songs (from db only)
async function getPopular(maxCount) {
	const query = "SELECT song, count FROM popular ORDER BY count DESC LIMIT ?"
	return (await executeQuery(query, [maxCount]))
		.map(row => ({ song: row?.[0], count: row?.[1] }))
}

// Return HTML for start page
app.get("/", (req, res) => {
	const topX = 3;
	Promise.all([getsongs(), getPopular(topX)]).then(values => {
		const songs = values[0]
		const popular = values[1]

		const songsHtml = songs.result
			.map(m => `<a href='songs/${m}'>${m}</a>`)
			.join(", ")

		const popularHtml = popular
			.map(pop => `<li> <a href='songs/${pop.song}'>${pop.song}</a> (${pop.count} views) </li>`)
			.join("\n")

		const html = `
			<h1>Top ${topX} songs</h1>		
			<p>
				<ol style="margin-left: 2em;"> ${popularHtml} </ol> 
			</p>
			<h1>All songs</h1>
			<p> ${songsHtml} </p>
		`
		sendResponse(res, html, songs.cached)
	})
})

// -------------------------------------------------------
// Get a specific song (from cache or DB)
// -------------------------------------------------------

async function getsong(song) {
	const query = "SELECT song, link, band FROM songs WHERE song = ?"
	const sanitizedSong = song.replace(/\W+/g, '_')
	const key = 'song_' + sanitizedSong
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, cachedata = ${cachedata}`)
		return { ...cachedata, cached: true }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [song]))?.[0] // first entry
		if (data) {
			let result = { song: data?.[0], heading: data?.[1], description: data?.[2] }
			console.log(`Got result=${result}, storing in cache`)
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { ...result, cached: false }
		} else {
			throw "No data found for this song"
		}
	}
}

app.get("/songs/:song", (req, res) => {
	let song = req.params["song"]

	// Send the tracking message to Kafka
	sendTrackingMessage({
		song,
		timestamp: Math.floor(new Date() / 1000)
	}).then(() => console.log(`Sent song=${song} to kafka topic=${options.kafkaTopicTracking}`))
		.catch(e => console.log("Error sending to kafka", e))

	// Send reply to browser
	getsong(song).then(data => {
		sendResponse(res, `<h1>${data.song}</h1><p>${data.heading}</p>` +
			data.description.split("\n").map(p => `<p>${p}</p>`).join("\n"),
			data.cached
		)
	}).catch(err => {
		sendResponse(res, `<h1>Error</h1><p>${err}</p>`, false)
	})
});

// -------------------------------------------------------
// Main method
// -------------------------------------------------------

app.listen(options.port, function () {
	console.log("Node app is running at http://localhost:" + options.port)
});
