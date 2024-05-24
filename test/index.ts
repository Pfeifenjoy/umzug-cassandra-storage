import { CassandraStorage } from "../src"
import { Client } from "cassandra-driver"
import { expect } from "chai"

const CASSANDRA_HOST = process.env.CASSANDRA_HOST ?? "localhost"

describe("cassandra storage", () => {
	const client = new Client({
		contactPoints: [CASSANDRA_HOST],
		localDataCenter: "datacenter1"
	})

	before(async () => {
		await client.connect()
	})

	after(async () => {
		await client.execute("DROP KEYSPACE IF EXISTS migrations;")
		await client.shutdown()
	})

	beforeEach(async () => {
		await client.execute("DROP KEYSPACE IF EXISTS migrations;")
	})

	it("sync create migrations table", async () => {
		const cassandraStorage = new CassandraStorage(client)
		const result1 = await client.execute("describe tables;")
		const tables1 = result1.rows.filter(
			row => row.get("keyspace_name") === "migrations"
		)
		expect(tables1).to.have.lengthOf(0)

		await cassandraStorage.sync()

		const result2 = await client.execute("describe tables;")
		const tables2 = result2.rows.filter(
			row => row.get("keyspace_name") === "migrations"
		)

		expect(tables2).to.have.lengthOf(1)
		expect(tables2[0]?.get("name")).to.be.eq("migrations")
	})

	it("sync use old migrations table", async () => {
		const cassandraStorage1 = new CassandraStorage(client)
		await cassandraStorage1.sync()
		await cassandraStorage1.logMigration({
			name: "migration-1",
			context: {}
		})

		const cassandraStorage2 = new CassandraStorage(client)
		await cassandraStorage2.sync()

		const migrations = await cassandraStorage2.executed()

		expect(migrations).to.have.lengthOf(1)
		expect(migrations[0]).to.be.eq("migration-1")
	})

	it("log migration", async () => {
		const cassandraStorage = new CassandraStorage(client)
		const migrations1 = await cassandraStorage.executed()
		expect(migrations1).to.have.lengthOf(0)

		await cassandraStorage.logMigration({
			name: "migration-1",
			context: {}
		})
		const migrations2 = await cassandraStorage.executed()
		expect(migrations2).to.have.lengthOf(1)
		expect(migrations2[0]).to.be.eq("migration-1")
	})

	it("unlog migration", async () => {
		const cassandraStorage = new CassandraStorage(client)
		const migrations1 = await cassandraStorage.executed()
		expect(migrations1).to.have.lengthOf(0)

		await cassandraStorage.logMigration({
			name: "migration-1",
			context: {}
		})
		const migrations2 = await cassandraStorage.executed()
		expect(migrations2).to.have.lengthOf(1)
		expect(migrations2[0]).to.be.eq("migration-1")

		await cassandraStorage.unlogMigration({
			name: "migration-1",
			context: {}
		})
		const migrations3 = await cassandraStorage.executed()
		expect(migrations3).to.have.lengthOf(0)
	})
})
