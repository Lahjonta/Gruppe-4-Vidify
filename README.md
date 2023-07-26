# Use Case: Most Streamed Songs on Video Streaming App Vidify

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
```
This work is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/4.0/ or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
```

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

Start Docker App
In Terminal: `minikube start`

## Deploy

To develop using [Skaffold](https://skaffold.dev/), use `skaffold dev`.

After deploying: `minikube tunnel`to access node.js app on localhost
