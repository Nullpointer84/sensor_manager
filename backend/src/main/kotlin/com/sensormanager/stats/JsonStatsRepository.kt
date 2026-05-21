package com.sensormanager.stats

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Repository

@Repository
class JsonStatsRepository(private val objectMapper: ObjectMapper) : StatsRepository {

    private val cached: SensorStats by lazy {
        ClassPathResource("data/stats.json").inputStream.use { input ->
            objectMapper.readValue(input)
        }
    }

    override fun stats(): SensorStats = cached
}
