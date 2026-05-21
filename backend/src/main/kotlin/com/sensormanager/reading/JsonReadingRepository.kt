package com.sensormanager.reading

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Repository

@Repository
class JsonReadingRepository(private val objectMapper: ObjectMapper) : ReadingRepository {

    private val latest: List<LatestReading> by lazy { read("data/latest-readings.json") }
    private val trend: List<TemperatureTrendPoint> by lazy { read("data/temperature-trend.json") }
    private val co2: List<Co2SummaryPoint> by lazy { read("data/iaq-summary.json") }

    override fun latestPerLocation(): List<LatestReading> = latest
    override fun temperatureTrend(): List<TemperatureTrendPoint> = trend
    override fun co2Summary(): List<Co2SummaryPoint> = co2

    private inline fun <reified T> read(path: String): T =
        ClassPathResource(path).inputStream.use { objectMapper.readValue(it) }
}
