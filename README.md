[![Build Status](https://drone.metthub.de/api/badges/Pfeifenjoy/umzug-cassandra-storage/status.svg)](https://drone.metthub.de/Pfeifenjoy/umzug-cassandra-storage)

# Umzug Cassandra Storage

This is an [Umzug](https://github.com/sequelize/umzug) storage for storing migrations in cassandra.


## Usage

```
import { CassandraStorage } from "@arwed/umzug-cassandra-storage"

const umzug = new Umzug({ storage: new CustomStorage(...), logger: console })
```
