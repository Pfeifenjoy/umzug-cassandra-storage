import { UmzugStorage, MigrationParams } from "umzug"
import { Client } from "cassandra-driver"

const CREATE_KEYSPACE = (keyspace: string) => `
CREATE KEYSPACE IF NOT EXISTS ${ keyspace }
WITH REPLICATION = {
	'class': 'SimpleStrategy',
	'replication_factor': 2
};
`

const CREATE_TABLE = (keyspace: string) => `
CREATE TABLE IF NOT EXISTS ${ keyspace }.migrations (
	name text PRIMARY KEY,
	created_at timestamp
);
`

const LOG_MIGRATION = (keyspace: string) => `
INSERT INTO ${ keyspace }.migrations (name, created_at)
VALUES (:name, :created_at);
`

const UNLOG_MIGRATION = (keyspace: string) => `
DELETE FROM ${ keyspace }.migrations
WHERE name = :name;
`

const LIST_MIGRATIONS = (keyspace: string) => `
SELECT * FROM ${ keyspace }.migrations;
`

export class CassandraStorage<T> implements UmzugStorage<T> {
	client: Client
	keyspace: string
	_synced = false

	constructor(client: Client, keyspace = "migrations") {
		this.client = client
		this.keyspace = keyspace
	}

	async sync() {
		if(this._synced)
			return

		await this.client.execute(CREATE_KEYSPACE(this.keyspace))

		await this.client.execute(CREATE_TABLE(this.keyspace))

		this._synced = true
	}

	async logMigration({ name }: MigrationParams<T>) {
		await this.sync()
		await this.client.execute(LOG_MIGRATION(this.keyspace), {
			name, created_at: new Date
		})
	}

	async unlogMigration({ name }: MigrationParams<T>) {
		await this.sync()
		await this.client.execute(UNLOG_MIGRATION(this.keyspace), {
			name
		})
	}

	async executed(): Promise<string[]> {
		await this.sync()
		const result = await this.client.execute(LIST_MIGRATIONS(this.keyspace));
		return result.rows.map(row => row.get("name"))
	}
}
