# Use Case: Most Streamed Songs on Video Streaming App Vidify

This project has been created by (Student-IDs of DHBW Mannheim):

- 7013900
- 9147121
- 6870324
- 1620893

## Apache License
```
Copyright 2023 BD-Vidify

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

```

## Creative Commons License

Shield: [![CC BY-NC-SA 4.0][cc-by-nc-sa-shield]][cc-by-nc-sa]

This work is licensed under a
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

[![CC BY-NC-SA 4.0][cc-by-nc-sa-image]][cc-by-nc-sa]

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg


## Prerequisites

A running Strimzi.io Kafka operator

```bash
helm repo add strimzi http://strimzi.io/charts/
helm upgrade --install my-kafka-operator strimzi/strimzi-kafka-operator
kubectl apply -f https://farberg.de/talks/big-data/code/helm-kafka-operator/kafka-cluster-def.yaml
```

A running Hadoop cluster with YARN (for checkpointing)

```bash
helm repo add pfisterer-hadoop https://pfisterer.github.io/apache-hadoop-helm/
helm upgrade --install my-hadoop-cluster pfisterer-hadoop/hadoop --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true
```

## Before Deploying

1. Start Docker App

2. In Terminal: `minikube start` (Please make sure to provide minikube with sufficient memory (e.g. 7-8GB)

## Deploy

To develop using [Skaffold](https://skaffold.dev/), use `skaffold dev`.

After deploying: `minikube tunnel`to access node.js app on localhost

## Idea of the Application

The Vidify Big Data Platform is an innovative application that allows users to enjoy a curated selection of music videos while tracking the popularity of these videos. The platform utilizes a variety of technologies, including Spark for Big Data processing, Kafka for Big Data messaging, MySQL for database management, HDFS as a Data Lake and Memcached as cache servers. The platform is embedded in a Node.js application and hosted via localhost, with Kubernetes serving as the load balancer to scale the application and ensure high availability.

The main feature of the Vidify platform is an interactive user interface displaying five music videos, from which users can make selections. The platform keeps track of how often each video is viewed, whether users access a video individually or click on the "randomly fetch some songs" command to play randomly selected music videos. The platform dynamically generates and updates a top list of the most popular videos, which is displayed to users.

## Architecture

The Vidify Big Data Platform is built on a microservices architecture, where each component has a specific task and communicates through interfaces. Here is an overview of the key components of the architecture:

1. Spark (Big Data Processing): Spark is used for processing large volumes of data to analyze video views and create the top list of popular videos. It enables fast and scalable data processing.

2. Kafka (Big Data Messaging): Kafka serves as the messaging layer to facilitate communication between different services. It ensures robust and reliable message transmission between components.

3. MySQL (Database Server): MySQL is used as the database to store information about the music videos, view counts, and other relevant data.

4. HDFS (Data Lake): HDFS acts as the central storage for large datasets, such as the music videos themselves. It provides high scalability and redundancy to make data storage secure and reliable.

5. Memcached (Cache Servers): Memcached is utilized as a cache to buffer frequently accessed data, such as the top list of popular videos, and improve query performance.

6. Node.js App (User Interface): The Node.js application provides the user interface where the five music videos are displayed. It also processes user interactions and sends requests to the respective services.

7. Kubernetes (Load Balancer): Kubernetes is used as the load balancer to ensure scalability of the platform and evenly distribute traffic among the different services.

## Design

The Vidify platform has been designed to enable efficient Big Data processing and provide a user-friendly interface. The design includes:

- Clear separation of services to allow easy scalability and maintenance.
- The use of Spark for rapid processing of large datasets, enabling real-time analysis of video views.
- Implementation of Kafka as the messaging layer to ensure robust and reliable communication between services.
- Utilization of MySQL as a reliable database for efficient storage of information about music videos and view counts.
- Inclusion of HDFS as a Data Lake to secure and scale the storage of music videos.
- Use of Memcached as a cache server to optimize query performance and buffer frequently accessed data.
- Integration of Kubernetes as a load balancer to ensure high availability and scalability of the platform.
- Development of an intuitive user interface using Node.js to provide users with a seamless and enjoyable music video experience while tracking video popularity.

The Vidify Big Data Platform showcases the potential of Big Data technologies combined with modern web applications, offering users an entertaining music video experience while enabling them to keep track of video popularity.
