// for X-Signature, currently we only use sparrow
export const SECRET_KEYS = {
	Phoenix_ovs: '223ecf843a8ad96f99ee3f92c54e164f',
	PICO_G3: '4b6fe3c0e550f9192e8b51af7b99b708',
	Pico_Neo_3: '50298ef2480372dae9e6cd430009efcd',
	Pico_Neo_3_Link: '7502f432280c2ac96d4494518cc300c1',
	sparrow: '73e0123394eb6ce8e09055f6f97c4e17',
} as const;

export type Product = keyof typeof SECRET_KEYS;
export type Region = 'china' | 'overseas';

export const otaPayload = (product: Product) =>
	JSON.stringify({
		// they do not check the x-signature access header, nor do they check any of the shite below this matches
		// you can identify as a PICO 4 Ultra Enterprise and they'll happily throw a phoenix ota at you
		product,
		product_name: 'PICO 4 Ultra Enterprise',
		//rom_version: "5.7.2-202308222237-RELEASE-user-phoenix-b5653",
		udid: 'PA81E0DAFH31ABC4G',
		os_version: '5.7.2',
		model: 'A81E0',
		language: 'en',
		flag: '0', // needsFullPackage
		did: '', // comes from bytedance's tracking library Tea, unsure of the format
		country_code: 'GB',
		channel: '',
		buildtime: '0',
		buildtype: 'user_sek',
		bc_flag: 1,
		apps: {
			'com.pvr.version': 200306031,
			'com.picovr.updatesystem': 200400017,
			'com.picopui.im': 100004001,
			'com.pvr.pvrfit': 100105013,
			'com.picovr.wing.videoplayer': 200300071,
			'com.pvr.filemanager': 100402023,
			'com.picovr.picostreamassistant': 901407000,
			'com.picovr.store': 300900056,
			'com.pvr.home': 101000010,
			'com.pvr.lanserver': 100023015,
			'com.pvr.avatareditor': 100306002,
			'com.picovr.vrusercenter': 200201024,
			'com.bytedance.pico.matrix': 500501010,
			'com.pico.xr.openxr_runtime': 200110136,
		},
	});

export async function getSignature(reqBody: string) {
	const bodyHash = new Uint8Array(await crypto.subtle.digest('MD5', new TextEncoder().encode(reqBody))).toHex();

	const signed = `POST\n\n${bodyHash}\n`;

	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(SECRET_KEYS.sparrow),
		{
			name: 'HMAC',
			hash: { name: 'SHA-256' },
		},
		false,
		['sign', 'verify'],
	);

	const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed))).toBase64();
	return `sparrow:${hmac}`;
}
