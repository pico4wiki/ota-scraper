import { getSignature, otaPayload } from "./ota";

export default {
	async fetch(req, env, ctx) {


		return new Response(`TODO`);
	},

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env, ctx): Promise<void> {

		// having issues getting Pico_Neo_3 and Pico_Neo_3_Link to work on global (apparently it works on CN?)
		// TODO: CN
		for (const headset of ["Phoenix_ovs", "PICO_G3", "sparrow"] as const) {
			const body = otaPayload(headset);
			const sig = await getSignature(body);

			const resp = await fetch('https://iot-global-api.picovr.com/open/v3/ota/check', {
				method: 'POST',
				body,
				headers: {
					'X-Signature': sig
				}
			}).then(r => r.json<any>());

			if (resp.errmsg)
				// dang!
				throw new Error(`err fetching ${headset} ${resp.errmsg}`)

			if (!resp.data) throw new Error(`err fetching ${headset} - no data returned but no errmsg either`);

			// check if its new, and if so, push to DB
		}
	},
} satisfies ExportedHandler<Env>;
