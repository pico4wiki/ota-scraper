import { getOtas, initIfNeeded, putFirmwareIfNew } from "./db";
import { getSignature, otaPayload } from "./ota";

export default {
	async fetch(req, env, ctx) {
		if (new URL(req.url).pathname === "/")
			return new Response(JSON.stringify(await getOtas(env)), {
				headers: {
					"content-type": "application/json",
					"cache-control": "max-age: 86400",
				},
			});

		return new Response("whuh?");
	},

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env, ctx): Promise<void> {
		await initIfNeeded(env);

		// having issues getting Pico_Neo_3 and Pico_Neo_3_Link to work on global (apparently it works on CN?)
		for (const region of ["china", "overseas"] as const) {
			const headsets =
				region === "overseas"
					? ([
							["phoenix", "sek"],
							["phoenix", "seko"],
							["merline", "sek"],
							["sparrow", "sek"],
						] as const)
					: ([
							//['phoenix', 'sek'],
							["phoenix", "seko"],
							//['neo3', 'sek'],
							//['neo3', 'k'],
							["merline", "sek"],
							["sparrow", "sek"],
						] as const);

			for (const [headset, variant] of headsets) {
				const body = otaPayload(headset, region, variant);
				const sig = await getSignature(body, region);

				const resp = await fetch(
					region === "overseas"
						? `https://iot-global-api.picovr.com/open/v3/ota/check`
						: "https://iot.smartisan.com/open/v3/ota/check",
					{
						method: "POST",
						body,
						headers: {
							"content-type": "application/json",
							"X-Signature": sig,
						},
					},
				).then((r) => r.json<any>());

				if (resp.errmsg)
					// dang!
					throw new Error(`err fetching ${headset} ${variant} ${resp.errmsg}`);

				if (!resp.data)
					throw new Error(`err fetching ${headset} ${variant} - no data returned but no errmsg either`);

				// check if its new, and if so, push to DB
				await putFirmwareIfNew(env, headset, variant, resp.data, region);
			}
		}
	},
} satisfies ExportedHandler<Env>;
