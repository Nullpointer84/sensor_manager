package com.sensormanager.landing

import com.sensormanager.device.Device
import com.sensormanager.device.DeviceRepository
import com.sensormanager.location.Location
import com.sensormanager.location.LocationRepository
import com.sensormanager.reading.Co2SummaryPoint
import com.sensormanager.reading.LatestReading
import com.sensormanager.reading.ReadingRepository
import com.sensormanager.reading.TemperatureTrendPoint
import com.sensormanager.stats.SensorStats
import com.sensormanager.stats.StatsRepository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Public read-only API consumed by the marketing landing page.
 *
 * This is the stable boundary the UI talks to. Storage swaps (JSON snapshot →
 * real database) happen behind the repository interfaces; this controller and
 * its REST contract do not change.
 */
@RestController
@RequestMapping("/api/landing")
class LandingController(
    private val statsRepository: StatsRepository,
    private val locationRepository: LocationRepository,
    private val deviceRepository: DeviceRepository,
    private val readingRepository: ReadingRepository,
) {

    @GetMapping("/stats")
    fun stats(): SensorStats = statsRepository.stats()

    @GetMapping("/locations")
    fun locations(): List<Location> = locationRepository.findAll()

    @GetMapping("/devices")
    fun devices(): List<Device> = deviceRepository.findAll()

    @GetMapping("/latest-readings")
    fun latestReadings(): List<LatestReading> = readingRepository.latestPerLocation()

    @GetMapping("/temperature-trend")
    fun temperatureTrend(): List<TemperatureTrendPoint> = readingRepository.temperatureTrend()

    @GetMapping("/co2-summary")
    fun co2Summary(): List<Co2SummaryPoint> = readingRepository.co2Summary()
}
