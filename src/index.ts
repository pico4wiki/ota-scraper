import { getOtas, initIfNeeded, putFirmwareIfNew } from './db';
import { getSignature, otaPayload } from './ota';

export default {
	async fetch(req, env, ctx) {
		if (new URL(req.url).pathname === '/')
			return new Response(JSON.stringify(await getOtas(env)), {
				headers: {
					'content-type': 'application/json',
					'cache-control': 'max-age: 86400',
				},
			});

		return new Response('whuh?');
	},

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env, ctx): Promise<void> {
		await initIfNeeded(env);

		// having issues getting Pico_Neo_3 and Pico_Neo_3_Link to work on global (apparently it works on CN?)
		// TODO: how CN work?
		for (const region of ['overseas'] as const) {
			for (const headset of ['Phoenix_ovs', 'PICO_G3', 'sparrow'] as const) {
				const body = otaPayload(headset);
				const sig = await getSignature(body);

				const resp = await fetch(`https://iot${region === 'overseas' ? '-global' : ''}-api.picovr.com/open/v3/ota/check`, {
					method: 'POST',
					body,
					headers: {
						'content-type': 'application/json',
						'X-Signature': sig,
					},
				}).then((r) => r.json<any>());

				if (resp.errmsg)
					// dang!
					throw new Error(`err fetching ${headset} ${resp.errmsg}`);

				if (!resp.data) throw new Error(`err fetching ${headset} - no data returned but no errmsg either`);

				// check if its new, and if so, push to DB
				await putFirmwareIfNew(env, headset, resp.data, region);
			}
		}
	},
} satisfies ExportedHandler<Env>;
