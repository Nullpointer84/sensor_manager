package com.sensormanager.stats

import com.fasterxml.jackson.databind.ObjectMapper
import com.sensormanager.common.loadJsonSnapshot
import org.springframework.stereotype.Repository

@Repository
internal class JsonStatsRepository(objectMapper: ObjectMapper) : StatsRepository {

    private val cached: SensorStats = loadJsonSnapshot(objectMapper, "stats")

    override fun stats(): SensorStats = cached
}
