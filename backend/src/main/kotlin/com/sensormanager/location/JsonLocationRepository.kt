package com.sensormanager.location

import com.fasterxml.jackson.databind.ObjectMapper
import com.sensormanager.common.loadJsonSnapshot
import org.springframework.stereotype.Repository

/**
 * JSON-backed implementation. Loads `data/locations.json` from the classpath
 * at bean construction (eagerly) so a missing/malformed file fails startup
 * with a clear message — not a vague 500 at first request. The file is
 * produced by `tools/build-data/parse-dump.mjs`.
 */
@Repository
internal class JsonLocationRepository(objectMapper: ObjectMapper) : LocationRepository {

    private val cached: List<Location> = loadJsonSnapshot(objectMapper, "locations")

    override fun findAll(): List<Location> = cached
}
