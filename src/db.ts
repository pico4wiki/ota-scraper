import { format } from "date-fns";
import { Product, Region } from "./ota";
import { tz } from "@date-fns/tz";

export function initIfNeeded(env: Env) {
	// exec only accepts single line inputs, thank you cloudfart
	return env.otas.prepare(`
		CREATE TABLE IF NOT EXISTS otas (
			buildNo   INTEGER PRIMARY KEY,
			product   TEXT NOT NULL,
			region    TEXT NOT NULL,
			md5       TEXT NOT NULL,
			url       TEXT NOT NULL, -- name is the last part of this anyway generally
			name      TEXT,
			version   TEXT NOT NULL,
			buildDate TEXT NOT NULL,
			data      TEXT           -- json lol
		)
	`).run();
}

type DbFirmware = {
	buildNo: number;
	product: Product;
	region: Region;
	md5: string;
	url: string;
	name?: string;
	version: string;
	buildDate: string;
	data?: string;
}

function parseFirmware(product: Product, region: Region, firmware: any): DbFirmware {
	// this doesn't always match the one in the string
	const buildDate = format(firmware.package[0].buildtime * 1000, "yyyyMMddHHmm", { in: tz("Asia/Shanghai") });
	const buildNo = parseInt(firmware.package[0].name?.match(/-b(\d+)-/)?.[1])

	if (isNaN(buildNo)) throw new Error("cannot parse firmware");

	return {
		buildDate,
		buildNo,
		product,
		region,
		md5: firmware.package[0].md5,
		url: firmware.package[0].url,
		name: firmware.package[0].name,
		version: firmware.package[0].version,
		data: JSON.stringify(firmware)
	};
}

export function mostRecentBuild(env: Env, product: Product, region: Region) {
	return env.otas
		.prepare(`SELECT * FROM otas WHERE product = ? AND region = ? ORDER BY buildNo DESC LIMIT 1`)
		.bind(product, region)
		.first<DbFirmware>();
}

export function putFirmware(env: Env, product: Product, firmware: any, region: Region = 'overseas') {
	const parsed = parseFirmware(product, region, firmware);

	env.otas
		.prepare(`INSERT INTO otas (buildNo, product, region, md5, url, name, version, buildDate, data) VALUES (?,?,?,?,?,?,?,?,?)`)
		.bind(parsed.buildNo, parsed.product, parsed.region, parsed.md5, parsed.url, parsed.name, parsed.version, parsed.buildDate, parsed.data)
		.run();
}

export async function putFirmwareIfNew(env: Env, product: Product, firmware: any, region: Region = 'overseas') {
	const mostRecent = await mostRecentBuild(env, product, region);

	const parsed = parseFirmware(product, region, firmware);

	if (!mostRecent || mostRecent.buildNo < parsed.buildNo)
		putFirmware(env, product, firmware, region);
}

export async function getOtas(env: Env) {
	const firmwares: Record<Product, DbFirmware[]> = {
		Phoenix_ovs: [],
		PICO_G3: [],
		Pico_Neo_3: [],
		Pico_Neo_3_Link: [],
		sparrow: []
	};

	// fuck performance im sure its fine
	const all = await env.otas.prepare("SELECT * FROM otas").all<DbFirmware>();

	for (const product in firmwares) {
		firmwares[product as Product] = all.results.filter(f => f.product === product);
	}

	return firmwares;
}
