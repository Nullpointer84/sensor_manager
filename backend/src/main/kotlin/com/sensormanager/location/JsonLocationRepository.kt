package com.sensormanager.location

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Repository

/**
 * JSON-backed implementation. Loads `data/locations.json` from the classpath
 * once, on first access. The file is produced by `tools/build-data/parse-dump.mjs`.
 */
@Repository
class JsonLocationRepository(private val objectMapper: ObjectMapper) : LocationRepository {

    private val cached: List<Location> by lazy {
        ClassPathResource("data/locations.json").inputStream.use { input ->
            objectMapper.readValue(input)
        }
    }

    override fun findAll(): List<Location> = cached
}
