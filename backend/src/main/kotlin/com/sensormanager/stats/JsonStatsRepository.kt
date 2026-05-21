package com.sensormanager.stats

import com.fasterxml.jackson.databind.ObjectMapper
import com.sensormanager.common.loadClasspathJson
import org.springframework.stereotype.Repository

@Repository
class JsonStatsRepository(objectMapper: ObjectMapper) : StatsRepository {

    private val cached: SensorStats = loadClasspathJson(objectMapper, "data/stats.json")

    override fun stats(): SensorStats = cached
}
