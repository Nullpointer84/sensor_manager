package com.sensormanager.reading

import com.fasterxml.jackson.databind.ObjectMapper
import com.sensormanager.common.loadJsonSnapshot
import org.springframework.stereotype.Repository

@Repository
internal class JsonReadingRepository(objectMapper: ObjectMapper) : ReadingRepository {

    private val latest: List<LatestReading> = loadJsonSnapshot(objectMapper, "latest-readings")
    private val trend: List<TemperatureTrendPoint> = loadJsonSnapshot(objectMapper, "temperature-trend")
    private val co2: List<Co2SummaryPoint> = loadJsonSnapshot(objectMapper, "iaq-summary")

    override fun latestPerLocation(): List<LatestReading> = latest
    override fun temperatureTrend(): List<TemperatureTrendPoint> = trend
    override fun co2Summary(): List<Co2SummaryPoint> = co2
}
