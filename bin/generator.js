require("dotenv").config()
const fs = require("fs")

const ALL_ROUTES = require(process.env.CONFIG_PATH)
const LOCATION_RESULT_FILE = process.env.LOCATION_RESULT_FILE
const ZONE_RESULT_FILE = process.env.ZONE_RESULT_FILE
const GROUPS = {
	"moderator-web": {
		"folder": process.env.MODERATOR_WEB_FOLDER,
		"upstream": "moderator_web_app",
		"zone": "moderator_web_cache",
	},
	"moderator-mobile": {
		"folder": process.env.MODERATOR_MOBILE_FOLDER,
		"upstream": "moderator_mobile_app",
		"zone": "moderator_mobile_cache",
	},
	"teacher": {
		"folder": process.env.TEACHER_FOLDER,
		"upstream": "teacher_app",
		"zone": "teacher_cache",
	},
	"parent": {
		"folder": process.env.PARENT_FOLDER,
		"upstream": "parent_app",
		"zone": "parent_cache",
	},
	"student": {
		"folder": process.env.STUDENT_FOLDER,
		"upstream": "student_app",
		"zone": "student_cache",
	},
}


// Route preparation
const routes = []
for (const route of ALL_ROUTES) {
	const urlSplit = route.url.split("/")
	const routeSplit = urlSplit.slice(2)
	const group = urlSplit[1].replace("-api", "")
	if (group !== "moderator-web") continue

	const isDynamic = urlSplit[urlSplit.length - 1].includes(":")
	if (isDynamic) {
		urlSplit.splice(urlSplit.length - 1, 1)
		urlSplit.push("(?<id>[0-9a-fA-F]{24})")
		routeSplit.splice(routeSplit.length - 1, 1)
	}

	let url
	if (!isDynamic) url = `/${urlSplit.slice(1).join("/")}`
	else url = `"${ urlSplit.slice(1).join("\\/") }"`

	const subUrl = routeSplit.join("/")

	routes.push({
		group: group,
		url: url,
		route: subUrl,
		ttl: route.ttl,
		isDynamic: isDynamic,
	})
}

// Zone configs
const zones = []
for (const key in GROUPS) {
	const group = GROUPS[key]
	zones.push(`proxy_cache_path ${group.folder} levels=1:2 keys_zone=${group.zone}:10m max_size=10g inactive=10m use_temp_path=off;`)
}

// Location configs
const PROXY_CONFIG_FILE = process.env.PROXY_CONFIG_FILE
const CACHE_CONFIG_FILE = process.env.CACHE_CONFIG_FILE

const locations = []
for (const route of routes) {
	const group = GROUPS[route.group]
	const modifier = route.isDynamic ? "~" : "="
	const redirect = route.isDynamic ? `http://${group.upstream}/${route.route}/$id` : `http://${group.upstream}/${route.route}`

	locations.push(`

# GROUP: ${route.group}
# ROUTE: /${route.route}${route.isDynamic ? "/:id" : ""}
# TTl:   ${route.ttl}m
location ${modifier} ${route.url} {
	# Redirect
	include ${PROXY_CONFIG_FILE}; # importing common proxy configurations
	proxy_pass ${redirect};

	# Cache
	proxy_cache ${group.zone};
	proxy_cache_key "$proxy_host$request_uri$http_authorization$http_branch$request_body";
	proxy_cache_valid 200 201 ${route.ttl}m;
	include ${CACHE_CONFIG_FILE}; # importing common cache configurations
}

	`.trim())
}


// Create if not exists
if (!fs.existsSync(ZONE_RESULT_FILE)) fs.writeFileSync(ZONE_RESULT_FILE, "")
if (!fs.existsSync(LOCATION_RESULT_FILE)) fs.writeFileSync(LOCATION_RESULT_FILE, "")

// Clear file`
fs.truncateSync(ZONE_RESULT_FILE, 0)
fs.truncateSync(LOCATION_RESULT_FILE, 0)

// Write to zone file
console.log(`Writing zones to file "${ZONE_RESULT_FILE}"`)
fs.writeFileSync(
	ZONE_RESULT_FILE,
	zones.join("\n").trim()
)

// Write to zone file
console.log(`Writing locations to file "${LOCATION_RESULT_FILE}"`)
fs.writeFileSync(
	LOCATION_RESULT_FILE,
	locations.join("\n\n").trim()
)