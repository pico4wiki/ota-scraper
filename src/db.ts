import { format } from "date-fns";
import { Headsets, Region, Variant } from "./ota";
import { tz } from "@date-fns/tz";

export function initIfNeeded(env: Env) {
	// exec only accepts single line inputs, thank you cloudfart
	return env.otas
		.prepare(`
		CREATE TABLE IF NOT EXISTS otas (
			buildNo   INTEGER PRIMARY KEY,
			product   TEXT NOT NULL,
			region    TEXT NOT NULL,
			md5       TEXT NOT NULL,
			url       TEXT NOT NULL, -- name is the last part of this anyway generally
			name      TEXT,
			version   TEXT NOT NULL,
			buildDate TEXT NOT NULL,
			variant   TEXT NOT NULL,
			data      TEXT           -- json lol
		)
	`)
		.run();
}

type DbFirmware = {
	buildNo: number;
	product: Headsets;
	region: Region;
	md5: string;
	url: string;
	name?: string;
	version: string;
	buildDate: string;
	variant: Variant;
	data?: string;
};

function parseFirmware(product: Headsets, region: Region, variant: Variant, firmware: any): DbFirmware {
	// this doesn't always match the one in the string
	const buildDate = format(firmware.package[0].buildtime * 1000, "yyyyMMddHHmm", { in: tz("Asia/Shanghai") });
	const buildNo = parseInt(firmware.package[0].name?.match(/-b(\d+)-/)?.[1]);

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
		variant,
		data: JSON.stringify(firmware),
	};
}

export function mostRecentBuild(env: Env, product: Headsets, variant: Variant, region: Region) {
	return env.otas
		.prepare(`SELECT * FROM otas WHERE product = ? AND region = ? AND variant = ? ORDER BY buildNo DESC LIMIT 1`)
		.bind(product, region, variant)
		.first<DbFirmware>();
}

export function putFirmware(env: Env, product: Headsets, variant: Variant, firmware: any, region: Region) {
	const parsed = parseFirmware(product, region, variant, firmware);

	return env.otas
		.prepare(
			`INSERT OR IGNORE INTO otas (buildNo, product, region, md5, url, name, version, buildDate, variant, data) VALUES (?,?,?,?,?,?,?,?,?,?)`,
		)
		.bind(
			parsed.buildNo,
			parsed.product,
			parsed.region,
			parsed.md5,
			parsed.url,
			parsed.name,
			parsed.version,
			parsed.buildDate,
			parsed.variant,
			parsed.data,
		)
		.run();
}

export async function putFirmwareIfNew(env: Env, product: Headsets, variant: Variant, firmware: any, region: Region) {
	const mostRecent = await mostRecentBuild(env, product, variant, region);

	const parsed = parseFirmware(product, region, variant, firmware);

	if (!mostRecent || mostRecent.buildNo < parsed.buildNo) return putFirmware(env, product, variant, firmware, region);
}

export async function getOtas(env: Env) {
	const firmwares: Record<Headsets, DbFirmware[]> = {
		phoenix: [],
		merline: [],
		neo3: [],
		sparrow: [],
	};

	// fuck performance im sure its fine
	const all = await env.otas.prepare("SELECT * FROM otas").all<DbFirmware>();

	for (const product in firmwares) {
		firmwares[product as Headsets] = all.results.filter((f) => f.product === product);
	}

	return firmwares;
}
