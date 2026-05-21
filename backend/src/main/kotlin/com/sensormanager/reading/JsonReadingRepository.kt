package com.sensormanager.reading

import com.fasterxml.jackson.databind.ObjectMapper
import com.sensormanager.common.loadClasspathJson
import org.springframework.stereotype.Repository

@Repository
internal class JsonReadingRepository(objectMapper: ObjectMapper) : ReadingRepository {

    private val latest: List<LatestReading> =
        loadClasspathJson(objectMapper, "data/latest-readings.json")
    private val trend: List<TemperatureTrendPoint> =
        loadClasspathJson(objectMapper, "data/temperature-trend.json")
    private val co2: List<Co2SummaryPoint> =
        loadClasspathJson(objectMapper, "data/iaq-summary.json")

    override fun latestPerLocation(): List<LatestReading> = latest
    override fun temperatureTrend(): List<TemperatureTrendPoint> = trend
    override fun co2Summary(): List<Co2SummaryPoint> = co2
}
