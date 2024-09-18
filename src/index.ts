import { UmzugStorage, MigrationParams } from "umzug"
import { Client } from "cassandra-driver"
import { Logger } from "./logger"

const CREATE_KEYSPACE = (keyspace: string) => `
CREATE KEYSPACE IF NOT EXISTS ${keyspace}
WITH REPLICATION = {
	'class': 'SimpleStrategy',
	'replication_factor': 2
};
`

const CREATE_TABLE = (keyspace: string) => `
CREATE TABLE IF NOT EXISTS ${keyspace}.migrations (
	name text PRIMARY KEY,
	created_at timestamp
);
`

const LOG_MIGRATION = (keyspace: string) => `
INSERT INTO ${keyspace}.migrations (name, created_at)
VALUES (:name, :created_at);
`

const UNLOG_MIGRATION = (keyspace: string) => `
DELETE FROM ${keyspace}.migrations
WHERE name = :name;
`

const LIST_MIGRATIONS = (keyspace: string) => `
SELECT * FROM ${keyspace}.migrations;
`

export type CassandraStorageProps = {
	logger?: Logger
	keyspace?: string
}

export class CassandraStorage<T> implements UmzugStorage<T> {
	client: Client
	logger: Logger
	keyspace: string
	_synced = false

	constructor(
		client: Client,
		{ logger, keyspace }: CassandraStorageProps = {}
	) {
		this.client = client
		this.keyspace = keyspace ?? "migrations"
		this.logger = logger ?? console
	}

	async sync() {
		this.logger.debug("sync called")
		if (this._synced) return

		this.logger.debug("executing create keyspace")
		const createKeyspaceQuery = CREATE_KEYSPACE(this.keyspace)
		this.logger.debug(`Query: ${createKeyspaceQuery}`)
		await this.client.execute(createKeyspaceQuery)

		this.logger.debug("executing create migrations table")
		const createTableQuery = CREATE_TABLE(this.keyspace)
		this.logger.debug(`Query: ${createTableQuery}`)
		await this.client.execute(createTableQuery)

		this._synced = true
		this.logger.debug("finished sync")
	}

	async logMigration({ name }: MigrationParams<T>) {
		this.logger.info(`log migration: ${name}`)
		await this.sync()
		const query = LOG_MIGRATION(this.keyspace)
		this.logger.debug(`Query: ${query}`)
		await this.client.execute(query, {
			name,
			created_at: new Date()
		})
		this.logger.debug("finished log migration")
	}

	async unlogMigration({ name }: MigrationParams<T>) {
		this.logger.info(`unlog migration: ${name}`)
		await this.sync()
		const query = UNLOG_MIGRATION(this.keyspace)
		this.logger.debug(`Query: ${query}`)
		await this.client.execute(query, {
			name
		})
		this.logger.debug("finished unlog migration")
	}

	async executed(): Promise<string[]> {
		this.logger.debug("executed")
		await this.sync()
		const query = LIST_MIGRATIONS(this.keyspace)
		this.logger.debug(`Query: ${query}`)
		const result = await this.client.execute(query)
		this.logger.debug("finished executed")
		return result.rows.map(row => row.get("name"))
	}
}
