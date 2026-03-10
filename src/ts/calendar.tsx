import * as React from 'react';
import { KaguyaProps as Props } from './kaguya';

interface HolidayCnDay {
    name: string;
    date: string;
    isOffDay: boolean;
}

interface HolidayCnYearResponse {
    year: number;
    days: HolidayCnDay[];
}

interface SpecialDayInfo {
    name: string;
    isOffDay: boolean;
}

interface SpecialDayMapByDate {
    [dateKey: string]: SpecialDayInfo;
}

interface SpecialDayMapByYear {
    [year: number]: SpecialDayMapByDate;
}

interface YearFlagMap {
    [year: number]: boolean;
}

interface WeatherLocation {
    latitude: number;
    longitude: number;
    label: string;
    isFallback: boolean;
    province?: string;
    city?: string;
    district?: string;
}

interface WeatherResponse {
    daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
    };
}

interface ReverseGeoResponse {
    principalSubdivision?: string;
    city?: string;
    locality?: string;
    address?: {
        state?: string;
        city?: string;
        county?: string;
        suburb?: string;
        town?: string;
    };
}

interface WeeklyWeatherItem {
    dateKey: string;
    weekday: string;
    weekdayShort: string;
    icon: string;
    weatherCode: number;
    weatherText: string;
    min: number;
    max: number;
}

interface ExtremeWeatherAlertItem {
    dateKey: string;
    code: number;
    icon: string;
    text: string;
}

interface WeatherAdvisoryRiskItem {
    dateKey: string;
    weatherCode: number;
    weatherText: string;
    min: number;
    max: number;
    tags: string[];
}

type WeatherMarkKind = 'normal' | 'rain' | 'snow' | 'extreme';

type WeatherSourceId = 'nmc' | 'openmeteo' | 'cache';

type WeatherLoadResult = {
    source: WeatherSourceId;
    providerLabel: string;
    locationLabel: string;
    weatherRows: WeeklyWeatherItem[];
};

type NmcProvinceItem = {
    code: string;
    name: string;
};

type NmcStationItem = {
    code: string;
    province: string;
    city: string;
};

type NmcPositionResponse = {
    code?: string;
    province?: string;
    city?: string;
};

type NmcWeatherResponse = {
    code?: number;
    data?: {
        predict?: {
            detail?: Array<{
                date?: string;
                day?: {
                    weather?: {
                        info?: string;
                        img?: string;
                        temperature?: string;
                    };
                };
                night?: {
                    weather?: {
                        info?: string;
                        img?: string;
                        temperature?: string;
                    };
                };
            }>;
        };
    };
};

type CachedWeatherPayload = {
    savedAt: number;
    providerLabel: string;
    locationLabel: string;
    weatherRows: WeeklyWeatherItem[];
};

type AreaInfo = {
    label: string | null;
    province: string;
    city: string;
    district: string;
};

type WeatherAdvisoryEventDetail = {
    location: string;
    forecastDays: number;
    badDays: WeatherAdvisoryRiskItem[];
};

type TodayWeatherEventDetail = {
    location: string;
    provider: string;
    today: WeeklyWeatherItem;
    forecastDays: number;
};

interface StateInterface {
    displayMonth: Date;
    selectedDate: Date;
    todayKey: string;
    now: Date;
    quickYear: number;
    quickMonth: number;
    quickDay: number;
    specialDaysByYear: SpecialDayMapByYear;
    loadingByYear: YearFlagMap;
    errorByYear: YearFlagMap;
    weeklyWeather: WeeklyWeatherItem[];
    weatherLoading: boolean;
    weatherError: boolean;
    weatherLocationLabel: string;
    weatherForecastDays: number;
    weatherProviderText: string;
}

const WEEK_TEXT = ['\u5468\u4e00', '\u5468\u4e8c', '\u5468\u4e09', '\u5468\u56db', '\u5468\u4e94', '\u5468\u516d', '\u5468\u65e5'];
const WEEK_TEXT_FULL = ['\u5468\u65e5', '\u5468\u4e00', '\u5468\u4e8c', '\u5468\u4e09', '\u5468\u56db', '\u5468\u4e94', '\u5468\u516d'];
const WEEK_TEXT_SHORT = ['\u65e5', '\u4e00', '\u4e8c', '\u4e09', '\u56db', '\u4e94', '\u516d'];
const WEATHER_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const WEATHER_FORECAST_TARGET_DAYS = 14; // 最大展示14天
const WEATHER_CACHE_STORAGE_KEY = 'kaguya:weather-cache:v3';
const HOLIDAY_CACHE_STORAGE_PREFIX = 'kaguya:holiday:';

const SHANGHAI_LOCATION: WeatherLocation = {
    latitude: 31.2304,
    longitude: 121.4737,
    label: '\u4e0a\u6d77',
    isFallback: true,
};

class Calendar extends React.Component<Props, StateInterface> {
    private timer: number | null;

    private weatherTimer: number | null;

    private resolvedWeatherLocation: WeatherLocation | null;

    private lastExtremeAlertSignature: string;

    constructor(props: Props, context: any) {
        super(props, context);
        const today = this.stripTime(new Date());
        this.timer = null;
        this.weatherTimer = null;
        this.resolvedWeatherLocation = null;
        this.lastExtremeAlertSignature = '';
        this.state = {
            displayMonth: new Date(today.getFullYear(), today.getMonth(), 1),
            selectedDate: today,
            todayKey: this.toDateKey(today),
            now: new Date(),
            quickYear: today.getFullYear(),
            quickMonth: today.getMonth() + 1,
            quickDay: today.getDate(),
            specialDaysByYear: {},
            loadingByYear: {},
            errorByYear: {},
            weeklyWeather: [],
            weatherLoading: true,
            weatherError: false,
            weatherLocationLabel: SHANGHAI_LOCATION.label,
            weatherForecastDays: 0,
            weatherProviderText: 'NMC',
        };
    }

    componentDidMount() {
        this.timer = window.setInterval(() => {
            const now = new Date();
            const nextTodayKey = this.toDateKey(now);
            this.setState((prevState) => {
                if (prevState.todayKey !== nextTodayKey) {
                    return { now, todayKey: nextTodayKey };
                }
                return { now, todayKey: prevState.todayKey };
            });
        }, 1000);

        this.fetchYearHolidays(this.state.displayMonth.getFullYear());
        void this.fetchWeeklyWeather();
        this.weatherTimer = window.setInterval(() => {
            void this.fetchWeeklyWeather();
        }, WEATHER_REFRESH_INTERVAL_MS);
    }

    componentWillUnmount() {
        if (this.timer !== null) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
        if (this.weatherTimer !== null) {
            window.clearInterval(this.weatherTimer);
            this.weatherTimer = null;
        }
    }

    componentDidUpdate(prevProps: Props, prevState: StateInterface) {
        const currentYear = this.state.displayMonth.getFullYear();
        const previousYear = prevState.displayMonth.getFullYear();
        if (currentYear !== previousYear) {
            void this.fetchYearHolidays(currentYear);
        }
    }

    private stripTime(date: Date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    private toDateKey(date: Date) {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private sameDate(a: Date, b: Date) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    private getDaysInMonth(year: number, month: number) {
        return new Date(year, month, 0).getDate();
    }

    private getYearOptions() {
        const currentYear = new Date().getFullYear();
        const start = 1900;
        const end = Math.max(2100, currentYear + 20);
        const options: number[] = [];
        for (let year = start; year <= end; year++) {
            options.push(year);
        }
        return options;
    }

    private formatTime(date: Date) {
        const hour = `${date.getHours()}`.padStart(2, '0');
        const minute = `${date.getMinutes()}`.padStart(2, '0');
        const second = `${date.getSeconds()}`.padStart(2, '0');
        return `${hour}:${minute}:${second}`;
    }

    private formatShortDate(dateKey: string) {
        const day = new Date(`${dateKey}T00:00:00`);
        if (Number.isNaN(day.getTime())) {
            return dateKey;
        }
        const monthText = `${day.getMonth() + 1}`.padStart(2, '0');
        const dateText = `${day.getDate()}`.padStart(2, '0');
        return `${monthText}/${dateText}`;
    }

    private compactWeatherProviderText(value: string) {
        const text = (value || '').trim();
        if (!text) {
            return 'NMC';
        }
        return text
            .replace(/中国气象局\(NMC\)\+Open-Meteo/gi, 'NMC + OpenMeteo')
            .replace(/中国气象局\(NMC\)/gi, 'NMC')
            .replace(/Open-Meteo/gi, 'OpenMeteo');
    }

    private getWeatherMeta(code: number): { icon: string; text: string; } {
        if (code === 0) return { icon: '\u2600\uFE0F', text: '\u6674' };
        if (code === 1) return { icon: '\ud83c\udf24\ufe0f', text: '\u6674\u95f4\u591a\u4e91' };
        if (code === 2) return { icon: '\u26C5', text: '\u591a\u4e91' };
        if (code === 3) return { icon: '\u2601\ufe0f', text: '\u9634' };
        if (code === 45 || code === 48) return { icon: '\ud83c\udf2b\ufe0f', text: '\u96fe' };
        if ((code >= 51 && code <= 57) || (code >= 80 && code <= 82)) return { icon: '\ud83c\udf26\ufe0f', text: '\u9635\u96e8' };
        if (code >= 61 && code <= 67) return { icon: '\ud83c\udf27\ufe0f', text: '\u964d\u96e8' };
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '\ud83c\udf28\ufe0f', text: '\u964d\u96ea' };
        if (code >= 95) return { icon: '\u26C8\ufe0f', text: '\u96f7\u96e8' };
        return { icon: '\ud83c\udf25\ufe0f', text: '\u591a\u4e91' };
    }

    private getDayWeatherMark(code: number): { icon: string; kind: WeatherMarkKind; text: string; } {
        if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
            return { icon: '\ud83c\udf27\ufe0f', kind: 'rain', text: '\u964d\u96e8' };
        }
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
            return { icon: '\u2744\ufe0f', kind: 'snow', text: '\u964d\u96ea' };
        }
        if (code >= 95) {
            return { icon: '\u26C8\ufe0f', kind: 'extreme', text: '\u5f3a\u5bf9\u6d41' };
        }
        const meta = this.getWeatherMeta(code);
        return {
            icon: meta.icon,
            kind: 'normal',
            text: meta.text,
        };
    }

    private getExtremeWeatherAlert(code: number): { icon: string; text: string; } | null {
        if (code >= 95) {
            return { icon: '\u26C8\ufe0f', text: '\u96f7\u66b4' };
        }
        if (code === 82 || code === 65 || code === 67 || code === 66) {
            return { icon: '\ud83c\udf27\ufe0f', text: '\u5f3a\u964d\u6c34' };
        }
        if (code === 86 || code === 75 || code === 77) {
            return { icon: '\u2744\ufe0f', text: '\u5f3a\u964d\u96ea' };
        }
        return null;
    }

    private getAdvisoryTags(code: number, min: number, max: number): string[] {
        const tags: string[] = [];
        if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
            tags.push('rain');
        }
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
            tags.push('snow');
        }
        if (code >= 95) {
            tags.push('thunder');
        }
        if (code === 45 || code === 48) {
            tags.push('fog');
        }
        if (min <= 8) {
            tags.push('cold');
        }
        if (max >= 34) {
            tags.push('heat');
        }
        return tags;
    }

    private emitThreeDayWeatherAdvisory(locationText: string, forecastDays: number, weatherRows: WeeklyWeatherItem[]) {
        const badDays = weatherRows.slice(0, 3).map((item) => {
            return {
                dateKey: item.dateKey,
                weatherCode: item.weatherCode,
                weatherText: item.weatherText,
                min: item.min,
                max: item.max,
                tags: this.getAdvisoryTags(item.weatherCode, item.min, item.max),
            };
        }).filter((item) => item.tags.length > 0);

        if (!badDays.length) {
            return;
        }

        const detail: WeatherAdvisoryEventDetail = {
            location: locationText,
            forecastDays,
            badDays,
        };
        window.dispatchEvent(new CustomEvent<WeatherAdvisoryEventDetail>('kaguya:weather-advisory', {
            detail,
        }));
    }

    private buildOpenMeteoWeatherUrl(location: WeatherLocation, forecastDays: number): string {
        const params = new URLSearchParams({
            latitude: `${location.latitude}`,
            longitude: `${location.longitude}`,
            timezone: 'auto',
            forecast_days: `${forecastDays}`,
            daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        });
        return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    }

    private async fetchJsonWithTimeout<T>(url: string, timeoutMs: number = 6200): Promise<T | null> {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            controller.abort();
        }, timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                return null;
            }
            const payload = await response.json() as T;
            return payload;
        } catch {
            return null;
        } finally {
            window.clearTimeout(timer);
        }
    }

    private normalizeAreaText(value: string): string {
        return value.replace(/\s+/g, '').trim();
    }

    private normalizeAreaToken(value: string): string {
        return this.normalizeAreaText(value)
            .replace(/(特别行政区|自治州|自治县|地区|新区|林区|县|区|市|省|盟|旗)$/g, '')
            .trim();
    }

    private parseReverseGeoPayload(payload: ReverseGeoResponse): AreaInfo | null {
        const province = typeof payload.principalSubdivision === 'string'
            ? this.normalizeAreaText(payload.principalSubdivision)
            : (typeof payload.address?.state === 'string' ? this.normalizeAreaText(payload.address.state) : '');
        const city = typeof payload.city === 'string'
            ? this.normalizeAreaText(payload.city)
            : (typeof payload.address?.city === 'string' ? this.normalizeAreaText(payload.address.city) : '');
        const district = typeof payload.locality === 'string'
            ? this.normalizeAreaText(payload.locality)
            : (
                typeof payload.address?.county === 'string'
                    ? this.normalizeAreaText(payload.address.county)
                    : (
                        typeof payload.address?.suburb === 'string'
                            ? this.normalizeAreaText(payload.address.suburb)
                            : (typeof payload.address?.town === 'string' ? this.normalizeAreaText(payload.address.town) : '')
                    )
            );

        if (!province && !city && !district) {
            return null;
        }

        let label = '';
        if (province && district) {
            label = province.includes(district) ? province : `${province}${district}`;
        } else if (province && city) {
            label = province.includes(city) ? province : `${province}${city}`;
        } else if (city && district) {
            label = city.includes(district) ? city : `${city}${district}`;
        } else {
            label = province || city || district;
        }

        return {
            label: label || null,
            province,
            city,
            district,
        };
    }

    private async reverseGeocodeViaBigDataCloud(latitude: number, longitude: number): Promise<AreaInfo | null> {
        const endpoint = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh-Hans`;
        const payload = await this.fetchJsonWithTimeout<ReverseGeoResponse>(endpoint, 4600);
        return payload ? this.parseReverseGeoPayload(payload) : null;
    }

    private async reverseGeocodeViaNominatim(latitude: number, longitude: number): Promise<AreaInfo | null> {
        const endpoint = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=zh-CN&lat=${latitude}&lon=${longitude}&zoom=12`;
        const payload = await this.fetchJsonWithTimeout<ReverseGeoResponse>(endpoint, 5200);
        return payload ? this.parseReverseGeoPayload(payload) : null;
    }

    private async reverseGeocodeToCounty(latitude: number, longitude: number): Promise<AreaInfo | null> {
        const primary = await this.reverseGeocodeViaBigDataCloud(latitude, longitude);
        if (primary) {
            return primary;
        }
        return this.reverseGeocodeViaNominatim(latitude, longitude);
    }

    private getNmcTextToCode(text: string): number {
        const normalized = this.normalizeAreaText(text);
        if (!normalized || normalized === '9999') {
            return -1;
        }
        if (normalized.includes('雷') || normalized.includes('冰雹')) {
            return 95;
        }
        if (normalized.includes('雪')) {
            return 71;
        }
        if (normalized.includes('雨')) {
            return 63;
        }
        if (normalized.includes('雾') || normalized.includes('霾')) {
            return 45;
        }
        if (normalized.includes('阴')) {
            return 3;
        }
        if (normalized.includes('多云')) {
            return 2;
        }
        if (normalized.includes('晴')) {
            return 0;
        }
        return 2;
    }

    private pickNmcWeatherCode(dayText: string, nightText: string): number {
        const dayCode = this.getNmcTextToCode(dayText);
        if (dayCode >= 0) {
            return dayCode;
        }
        const nightCode = this.getNmcTextToCode(nightText);
        if (nightCode >= 0) {
            return nightCode;
        }
        return 2;
    }

    private toNmcTemp(value: string | undefined): number | null {
        if (typeof value !== 'string') {
            return null;
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed === 9999) {
            return null;
        }
        return Math.round(parsed);
    }

    private pickNmcLabel(...candidates: Array<string | undefined>): string {
        for (let index = 0; index < candidates.length; index++) {
            const current = typeof candidates[index] === 'string' ? this.normalizeAreaText(candidates[index] as string) : '';
            if (current && current !== '9999') {
                return current;
            }
        }
        return '多云';
    }

    private parseNmcPredictRows(payload: NmcWeatherResponse, targetDays: number): WeeklyWeatherItem[] {
        const detail = payload.data?.predict?.detail;
        if (!Array.isArray(detail) || !detail.length) {
            return [];
        }

        const rows: WeeklyWeatherItem[] = [];
        for (let index = 0; index < detail.length && rows.length < targetDays; index++) {
            const item = detail[index];
            const dateKey = typeof item.date === 'string' ? item.date : '';
            if (!dateKey) {
                continue;
            }

            const dayText = this.pickNmcLabel(item.day?.weather?.info);
            const nightText = this.pickNmcLabel(item.night?.weather?.info);
            const weatherCode = this.pickNmcWeatherCode(dayText, nightText);
            const meta = this.getWeatherMeta(weatherCode);
            const dayTemp = this.toNmcTemp(item.day?.weather?.temperature);
            const nightTemp = this.toNmcTemp(item.night?.weather?.temperature);
            const max = dayTemp !== null
                ? dayTemp
                : (nightTemp !== null ? nightTemp : 0);
            const min = nightTemp !== null
                ? nightTemp
                : (dayTemp !== null ? dayTemp : 0);

            const day = new Date(`${dateKey}T00:00:00`);
            const weekText = Number.isNaN(day.getTime()) ? '--' : WEEK_TEXT_FULL[day.getDay()];
            const weekTextShort = Number.isNaN(day.getTime()) ? '-' : WEEK_TEXT_SHORT[day.getDay()];
            const weatherText = this.pickNmcLabel(item.day?.weather?.info, item.night?.weather?.info, meta.text);
            rows.push({
                dateKey,
                weekday: weekText,
                weekdayShort: weekTextShort,
                icon: meta.icon,
                weatherCode,
                weatherText,
                min: Math.min(min, max),
                max: Math.max(min, max),
            });
        }
        return rows;
    }

    private pickBestNmcStation(stations: NmcStationItem[], location: WeatherLocation): NmcStationItem | null {
        if (!stations.length) {
            return null;
        }

        const tokenList = [
            this.normalizeAreaToken(location.district || ''),
            this.normalizeAreaToken(location.city || ''),
            this.normalizeAreaToken(location.province || ''),
            this.normalizeAreaToken(location.label || ''),
        ].filter((item) => item);

        if (!tokenList.length) {
            return stations[0];
        }

        let best: NmcStationItem | null = null;
        let bestScore = -1;
        stations.forEach((station) => {
            const stationCity = this.normalizeAreaToken(station.city || '');
            let score = 0;
            tokenList.forEach((token) => {
                if (!token || !stationCity) {
                    return;
                }
                if (stationCity === token) {
                    score += 12;
                    return;
                }
                if (stationCity.includes(token) || token.includes(stationCity)) {
                    score += 8;
                    return;
                }
                if (stationCity.slice(0, 2) === token.slice(0, 2)) {
                    score += 3;
                }
            });

            if (score > bestScore) {
                best = station;
                bestScore = score;
            }
        });

        return best || stations[0];
    }

    private async resolveNmcStation(location: WeatherLocation): Promise<NmcStationItem | null> {
        const provinceList = await this.fetchJsonWithTimeout<NmcProvinceItem[]>('https://www.nmc.cn/rest/province');
        const provinceToken = this.normalizeAreaToken(location.province || location.city || location.label || '');
        if (Array.isArray(provinceList) && provinceList.length && provinceToken) {
            const matchedProvince = provinceList.find((provinceItem) => {
                const normalizedProvinceName = this.normalizeAreaToken(provinceItem.name || '');
                return normalizedProvinceName
                    && (normalizedProvinceName.includes(provinceToken) || provinceToken.includes(normalizedProvinceName));
            });

            if (matchedProvince?.code) {
                const stationList = await this.fetchJsonWithTimeout<NmcStationItem[]>(`https://www.nmc.cn/rest/province/${matchedProvince.code}`);
                if (Array.isArray(stationList) && stationList.length) {
                    const bestMatch = this.pickBestNmcStation(stationList, location);
                    if (bestMatch?.code) {
                        return bestMatch;
                    }
                }
            }
        }

        const ipStation = await this.fetchJsonWithTimeout<NmcPositionResponse>('https://www.nmc.cn/rest/position');
        if (ipStation?.code) {
            return {
                code: ipStation.code,
                province: this.normalizeAreaText(ipStation.province || ''),
                city: this.normalizeAreaText(ipStation.city || ''),
            };
        }
        return null;
    }

    private async loadFromNmc(location: WeatherLocation, targetDays: number): Promise<WeatherLoadResult | null> {
        const station = await this.resolveNmcStation(location);
        if (!station?.code) {
            return null;
        }

        const payload = await this.fetchJsonWithTimeout<NmcWeatherResponse>(`https://www.nmc.cn/rest/weather?stationid=${station.code}`, 7200);
        if (!payload || payload.code !== 0) {
            return null;
        }

        const weatherRows = this.parseNmcPredictRows(payload, targetDays);
        if (!weatherRows.length) {
            return null;
        }

        const stationLabel = this.normalizeAreaText(`${station.province || ''}${station.city || ''}`) || location.label;
        return {
            source: 'nmc',
            providerLabel: 'NMC',
            locationLabel: stationLabel,
            weatherRows,
        };
    }

    private async loadFromOpenMeteo(location: WeatherLocation, targetDays: number): Promise<WeatherLoadResult | null> {
        const response = await fetch(this.buildOpenMeteoWeatherUrl(location, targetDays));
        if (!response.ok) {
            return null;
        }

        const data = await response.json() as WeatherResponse;
        const days = data.daily?.time ?? [];
        const codes = data.daily?.weather_code ?? [];
        const maxList = data.daily?.temperature_2m_max ?? [];
        const minList = data.daily?.temperature_2m_min ?? [];
        if (!days.length || !codes.length || !maxList.length || !minList.length) {
            return null;
        }

        const weatherRows = days.slice(0, Math.min(targetDays, days.length)).map((dateKey: string, index: number) => {
            const day = new Date(`${dateKey}T00:00:00`);
            const weekText = Number.isNaN(day.getTime()) ? '--' : WEEK_TEXT_FULL[day.getDay()];
            const weekTextShort = Number.isNaN(day.getTime()) ? '-' : WEEK_TEXT_SHORT[day.getDay()];
            const weatherCode = Number(codes[index] ?? -1);
            const meta = this.getWeatherMeta(weatherCode);
            return {
                dateKey,
                weekday: weekText,
                weekdayShort: weekTextShort,
                icon: meta.icon,
                weatherCode,
                weatherText: meta.text,
                min: Math.round(Number(minList[index] ?? 0)),
                max: Math.round(Number(maxList[index] ?? 0)),
            };
        });

        if (!weatherRows.length) {
            return null;
        }

        const locationLabel = location.isFallback
            ? `${location.label}（默认）`
            : location.label;

        return {
            source: 'openmeteo',
            providerLabel: 'OpenMeteo',
            locationLabel,
            weatherRows,
        };
    }

    private mergeForecastRows(primaryRows: WeeklyWeatherItem[], fallbackRows: WeeklyWeatherItem[], targetDays: number): WeeklyWeatherItem[] {
        const mergedMap: Record<string, WeeklyWeatherItem> = {};
        primaryRows.forEach((item) => {
            mergedMap[item.dateKey] = item;
        });
        fallbackRows.forEach((item) => {
            if (!mergedMap[item.dateKey]) {
                mergedMap[item.dateKey] = item;
            }
        });
        return Object.keys(mergedMap)
            .sort()
            .slice(0, targetDays)
            .map((dateKey) => mergedMap[dateKey]);
    }

    private saveWeatherCache(result: WeatherLoadResult): void {
        try {
            const payload: CachedWeatherPayload = {
                savedAt: Date.now(),
                providerLabel: result.providerLabel,
                locationLabel: result.locationLabel,
                weatherRows: result.weatherRows,
            };
            window.localStorage.setItem(WEATHER_CACHE_STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // ignore storage issues
        }
    }

    private loadWeatherCache(): WeatherLoadResult | null {
        try {
            const raw = window.localStorage.getItem(WEATHER_CACHE_STORAGE_KEY);
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw) as CachedWeatherPayload;
            if (!parsed || !Array.isArray(parsed.weatherRows) || !parsed.weatherRows.length) {
                return null;
            }
            const weatherRows = parsed.weatherRows.filter((item) => {
                return item
                    && typeof item.dateKey === 'string'
                    && typeof item.icon === 'string'
                    && typeof item.weatherText === 'string'
                    && Number.isFinite(item.min)
                    && Number.isFinite(item.max);
            });
            if (!weatherRows.length) {
                return null;
            }

            return {
                source: 'cache',
                providerLabel: parsed.providerLabel || '本地缓存',
                locationLabel: parsed.locationLabel || SHANGHAI_LOCATION.label,
                weatherRows,
            };
        } catch {
            return null;
        }
    }

    private emitTodayWeatherSnapshot(locationText: string, providerText: string, weatherRows: WeeklyWeatherItem[]) {
        if (!weatherRows.length) {
            return;
        }
        const todayKey = this.toDateKey(new Date());
        const todayItem = weatherRows.find((item) => item.dateKey === todayKey) || weatherRows[0];
        if (!todayItem) {
            return;
        }
        const detail: TodayWeatherEventDetail = {
            location: locationText,
            provider: providerText,
            today: todayItem,
            forecastDays: weatherRows.length,
        };
        window.dispatchEvent(new CustomEvent<TodayWeatherEventDetail>('kaguya:today-weather', { detail }));
    }

    private postExtremeWeatherMessage(locationText: string, forecastDays: number, alerts: ExtremeWeatherAlertItem[]) {
        const signature = alerts.map((item) => `${item.dateKey}:${item.code}`).join('|');
        if (signature === this.lastExtremeAlertSignature) {
            return;
        }
        this.lastExtremeAlertSignature = signature;

        if (!alerts.length) {
            return;
        }

        const payload = {
            type: 'kaguya:weather-extreme-alert',
            timestamp: new Date().toISOString(),
            location: locationText,
            forecastDays,
            alerts,
        };

        window.postMessage(payload, '*');
        if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, '*');
        }
    }

    private async resolveWeatherLocation(): Promise<WeatherLocation> {
        if (this.resolvedWeatherLocation) {
            return this.resolvedWeatherLocation;
        }
        if (!('geolocation' in navigator)) {
            this.resolvedWeatherLocation = SHANGHAI_LOCATION;
            return SHANGHAI_LOCATION;
        }

        const coordinates = await new Promise<{ latitude: number; longitude: number; } | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position: GeolocationPosition) => {
                    const { latitude, longitude } = position.coords;
                    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                        resolve(null);
                        return;
                    }
                    resolve({ latitude, longitude });
                },
                () => {
                    resolve(null);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 7000,
                    maximumAge: 10 * 60 * 1000,
                },
            );
        });

        if (!coordinates) {
            this.resolvedWeatherLocation = SHANGHAI_LOCATION;
            return SHANGHAI_LOCATION;
        }

        const areaInfo = await this.reverseGeocodeToCounty(coordinates.latitude, coordinates.longitude);
        const location: WeatherLocation = {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            label: areaInfo?.label || `\u5f53\u524d\u4f4d\u7f6e (${coordinates.latitude.toFixed(2)}, ${coordinates.longitude.toFixed(2)})`,
            isFallback: false,
            province: areaInfo?.province,
            city: areaInfo?.city,
            district: areaInfo?.district,
        };
        this.resolvedWeatherLocation = location;
        return location;
    }

    private async fetchWeeklyWeather() {
        this.setState({ weatherLoading: true, weatherError: false });
        try {
            const location = await this.resolveWeatherLocation();
            const targetDays = WEATHER_FORECAST_TARGET_DAYS;

            // 竞速模式：同时发送多个请求，哪个先回来就用哪个
            const providers = [
                { name: 'nmc', fn: () => this.loadFromNmc(location, targetDays) },
                { name: 'openMeteo', fn: () => this.loadFromOpenMeteo(location, targetDays) },
                { name: 'cache', fn: () => this.loadWeatherCache() },
            ];

            // 使用 Promise.race 和 Promise.allSettled 实现竞速
            let selectedResult: WeatherLoadResult | null = null;
            let settledCount = 0;

            const racePromise = new Promise<WeatherLoadResult | null>((resolve) => {
                providers.forEach(async (provider) => {
                    try {
                        const result = await provider.fn();
                        if (result && result.weatherRows.length > 0 && !selectedResult) {
                            selectedResult = result;
                            resolve(result);
                        }
                    } catch {
                        // 忽略错误，继续等待其他请求
                    } finally {
                        settledCount++;
                        if (settledCount === providers.length && !selectedResult) {
                            resolve(null);
                        }
                    }
                });
            });

            selectedResult = await racePromise;

            if (!selectedResult) {
                throw new Error('no weather source available');
            }

            // 如果 NMC 数据不足，尝试补充
            if (selectedResult.source === 'nmc' && selectedResult.weatherRows.length < targetDays) {
                try {
                    const supplement = await this.loadFromOpenMeteo(location, targetDays);
                    if (supplement?.weatherRows?.length) {
                        selectedResult = {
                            source: 'nmc',
                            providerLabel: 'NMC + OpenMeteo',
                            locationLabel: selectedResult.locationLabel || supplement.locationLabel,
                            weatherRows: this.mergeForecastRows(selectedResult.weatherRows, supplement.weatherRows, targetDays),
                        };
                    }
                } catch {
                    // 补充失败，使用已有数据
                }
            }

            // 根据容器宽度决定展示天数
            const containerWidth = this.calendarRef?.current?.offsetWidth || 360;
            const displayDays = containerWidth <= 360 ? 10 : targetDays; // 宽度小展示10天，否则14天
            selectedResult.weatherRows = selectedResult.weatherRows.slice(0, displayDays);

            if (!selectedResult.weatherRows.length) {
                throw new Error('weather rows empty');
            }

            if (selectedResult.source !== 'cache') {
                this.saveWeatherCache(selectedResult);
            }

            const extremeAlerts: ExtremeWeatherAlertItem[] = [];
            selectedResult.weatherRows.forEach((item) => {
                const alert = this.getExtremeWeatherAlert(item.weatherCode);
                if (!alert) {
                    return;
                }
                extremeAlerts.push({
                    dateKey: item.dateKey,
                    code: item.weatherCode,
                    icon: alert.icon,
                    text: alert.text,
                });
            });
            this.postExtremeWeatherMessage(selectedResult.locationLabel, selectedResult.weatherRows.length, extremeAlerts);
            this.emitThreeDayWeatherAdvisory(selectedResult.locationLabel, selectedResult.weatherRows.length, selectedResult.weatherRows);
            this.emitTodayWeatherSnapshot(selectedResult.locationLabel, selectedResult.providerLabel, selectedResult.weatherRows);

            this.setState({
                weeklyWeather: selectedResult.weatherRows,
                weatherLoading: false,
                weatherError: selectedResult.source === 'cache',
                weatherLocationLabel: selectedResult.locationLabel,
                weatherForecastDays: selectedResult.weatherRows.length,
                weatherProviderText: selectedResult.providerLabel,
            });
        } catch {
            this.setState({ weatherLoading: false, weatherError: true });
        }
    }

    private getHolidayCacheKey(year: number): string {
        return `${HOLIDAY_CACHE_STORAGE_PREFIX}${year}`;
    }

    private loadHolidayCache(year: number): HolidayCnYearResponse | null {
        try {
            const raw = window.localStorage.getItem(this.getHolidayCacheKey(year));
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw) as HolidayCnYearResponse;
            if (!parsed || !Array.isArray(parsed.days)) {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    private saveHolidayCache(year: number, data: HolidayCnYearResponse): void {
        try {
            window.localStorage.setItem(this.getHolidayCacheKey(year), JSON.stringify(data));
        } catch {
            // ignore storage issues
        }
    }

    private async fetchYearHolidays(year: number) {
        if (this.state.specialDaysByYear[year] || this.state.loadingByYear[year]) {
            return;
        }

        this.setState((prevState) => ({
            loadingByYear: { ...prevState.loadingByYear, [year]: true },
            errorByYear: { ...prevState.errorByYear, [year]: false },
        }));

        try {
            const endpointList = [
                `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
                `https://fastly.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
                `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`,
            ];

            let data: HolidayCnYearResponse | null = null;
            for (let index = 0; index < endpointList.length; index++) {
                try {
                    const response = await fetch(endpointList[index]);
                    if (!response.ok) {
                        continue;
                    }
                    const parsed = await response.json() as HolidayCnYearResponse;
                    if (parsed && Array.isArray(parsed.days)) {
                        data = parsed;
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!data) {
                data = this.loadHolidayCache(year);
            }

            if (!data) {
                throw new Error('Holiday API request failed.');
            }

            const specialDayMap: SpecialDayMapByDate = {};
            data.days.forEach((item) => {
                if (!item || typeof item.date !== 'string' || typeof item.name !== 'string' || typeof item.isOffDay !== 'boolean') {
                    return;
                }
                specialDayMap[item.date] = {
                    name: item.name.trim() || '\u8282\u5047\u65e5',
                    isOffDay: item.isOffDay,
                };
            });
            this.saveHolidayCache(year, data);

            this.setState((prevState) => ({
                specialDaysByYear: { ...prevState.specialDaysByYear, [year]: specialDayMap },
                loadingByYear: { ...prevState.loadingByYear, [year]: false },
                errorByYear: { ...prevState.errorByYear, [year]: false },
            }));
        } catch {
            this.setState((prevState) => ({
                loadingByYear: { ...prevState.loadingByYear, [year]: false },
                errorByYear: { ...prevState.errorByYear, [year]: true },
            }));
        }
    }

    private shiftMonth(step: number) {
        this.setState((prevState) => {
            const current = prevState.displayMonth;
            return {
                displayMonth: new Date(current.getFullYear(), current.getMonth() + step, 1),
            };
        });
    }

    private jumpToToday() {
        const today = this.stripTime(new Date());
        this.setState({
            displayMonth: new Date(today.getFullYear(), today.getMonth(), 1),
            selectedDate: today,
            todayKey: this.toDateKey(today),
            quickYear: today.getFullYear(),
            quickMonth: today.getMonth() + 1,
            quickDay: today.getDate(),
        });
    }

    private jumpToQuickDate() {
        const daysInMonth = this.getDaysInMonth(this.state.quickYear, this.state.quickMonth);
        const safeDay = Math.min(this.state.quickDay, daysInMonth);
        const nextDate = new Date(this.state.quickYear, this.state.quickMonth - 1, safeDay);
        this.setState({
            displayMonth: new Date(nextDate.getFullYear(), nextDate.getMonth(), 1),
            selectedDate: this.stripTime(nextDate),
            quickDay: safeDay,
        });
    }

    private getMonthGrid(displayMonth: Date) {
        const year = displayMonth.getFullYear();
        const month = displayMonth.getMonth();
        const firstDate = new Date(year, month, 1);
        const startOffset = (firstDate.getDay() + 6) % 7;
        const gridStart = new Date(year, month, 1 - startOffset);
        const days: Date[] = [];

        for (let index = 0; index < 42; index++) {
            days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
        }
        return days;
    }

    render(): JSX.Element {
        const displayMonth = this.state.displayMonth;
        const selectedDate = this.state.selectedDate;
        const year = displayMonth.getFullYear();
        const month = displayMonth.getMonth();
        const monthText = `${year}\u5e74${month + 1}\u6708`;
        const calendarDays = this.getMonthGrid(displayMonth);
        const selectedKey = this.toDateKey(selectedDate);
        const selectedSpecialDay = this.state.specialDaysByYear[selectedDate.getFullYear()]?.[selectedKey];
        const isSelectedWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
        const isYearLoading = this.state.loadingByYear[year];
        const isYearError = this.state.errorByYear[year];
        const selectedWeekText = WEEK_TEXT_FULL[selectedDate.getDay()];
        const infoText = selectedSpecialDay
            ? `${selectedSpecialDay.isOffDay ? '\u4f11' : '\u73ed'} \u00b7 ${selectedSpecialDay.name}`
            : (isSelectedWeekend ? '\u5468\u672b' : '\u5de5\u4f5c\u65e5');
        const statusText = [
            this.state.weatherError ? '\u5929\u6c14\u63a5\u53e3\u6682\u4e0d\u53ef\u7528\uff0c\u5df2\u81ea\u52a8\u964d\u7ea7\u4e3a\u5907\u7528\u6570\u636e\u3002' : '',
            isYearLoading ? '\u5047\u65e5\u4e0e\u8c03\u4f11\u6570\u636e\u52a0\u8f7d\u4e2d...' : '',
            (!isYearLoading && isYearError) ? '\u8282\u5047\u65e5\u63a5\u53e3\u4e0d\u53ef\u7528\uff0c\u5df2\u56de\u9000\u666e\u901a\u65e5\u5386\u3002' : '',
        ].filter((item) => item).join(' ');
        const quickDaysMax = this.getDaysInMonth(this.state.quickYear, this.state.quickMonth);
        const yearOptions = this.getYearOptions();
        const liveTimeText = this.formatTime(this.state.now);
        const weatherByDate: Record<string, WeeklyWeatherItem> = {};
        this.state.weeklyWeather.forEach((item) => {
            weatherByDate[item.dateKey] = item;
        });
        const weatherProviderCompact = this.compactWeatherProviderText(this.state.weatherProviderText);
        const weatherMetaText = `定位 ${this.state.weatherLocationLabel} · 源 ${weatherProviderCompact} · ${this.state.weatherForecastDays}天`;

        return (
            <div className={`${this.props.prefix}-calendar`}>
                <div className={`${this.props.prefix}-calendar-live-time`}>{liveTimeText}</div>

                <div className={`${this.props.prefix}-calendar-weather`}>
                    {this.state.weatherLoading ? (
                        <div className={`${this.props.prefix}-calendar-weather-loading`}>
                            {'\u5929\u6c14\u52a0\u8f7d\u4e2d...'}
                        </div>
                    ) : (
                        this.state.weeklyWeather.map((item) => (
                            <div className={`${this.props.prefix}-calendar-weather-item`} key={item.dateKey} title={`${item.dateKey} ${item.weatherText} ${item.min}\u00b0~${item.max}\u00b0`}>
                                <div className={`${this.props.prefix}-calendar-weather-headline`}>
                                    <span className={`${this.props.prefix}-calendar-weather-date`}>{this.formatShortDate(item.dateKey)}</span>
                                    <span className={`${this.props.prefix}-calendar-weather-day`}>{item.weekdayShort}</span>
                                </div>
                                <span className={`${this.props.prefix}-calendar-weather-icon`}>{item.icon}</span>
                                <span className={`${this.props.prefix}-calendar-weather-temp`}>{`${item.min}~${item.max}\u00b0`}</span>
                            </div>
                        ))
                    )}
                </div>
                <div className={`${this.props.prefix}-calendar-weather-location`}>
                    {weatherMetaText}
                </div>

                <div className={`${this.props.prefix}-calendar-quick`}>
                    <select
                        className={`${this.props.prefix}-calendar-select`}
                        value={this.state.quickYear}
                        onChange={(event) => {
                            const nextYear = Number(event.target.value);
                            const maxDay = this.getDaysInMonth(nextYear, this.state.quickMonth);
                            this.setState({
                                quickYear: nextYear,
                                quickDay: Math.min(this.state.quickDay, maxDay),
                            });
                        }}
                    >
                        {yearOptions.map((yearOption) => (
                            <option key={yearOption} value={yearOption}>{`${yearOption}\u5e74`}</option>
                        ))}
                    </select>
                    <select
                        className={`${this.props.prefix}-calendar-select`}
                        value={this.state.quickMonth}
                        onChange={(event) => {
                            const nextMonth = Number(event.target.value);
                            const maxDay = this.getDaysInMonth(this.state.quickYear, nextMonth);
                            this.setState({
                                quickMonth: nextMonth,
                                quickDay: Math.min(this.state.quickDay, maxDay),
                            });
                        }}
                    >
                        {Array.from({ length: 12 }, (_, index) => index + 1).map((monthOption) => (
                            <option key={monthOption} value={monthOption}>{`${monthOption}\u6708`}</option>
                        ))}
                    </select>
                    <select
                        className={`${this.props.prefix}-calendar-select`}
                        value={this.state.quickDay}
                        onChange={(event) => {
                            this.setState({ quickDay: Number(event.target.value) });
                        }}
                    >
                        {Array.from({ length: quickDaysMax }, (_, index) => index + 1).map((dayOption) => (
                            <option key={dayOption} value={dayOption}>{`${dayOption}\u65e5`}</option>
                        ))}
                    </select>
                    <button
                        className={`${this.props.prefix}-calendar-go`}
                        onClick={() => { this.jumpToQuickDate(); }}
                    >
                        {'\u8df3\u8f6c'}
                    </button>
                </div>

                <ul className={`${this.props.prefix}-calendar-week`}>
                    {WEEK_TEXT.map((weekName) => (
                        <li key={weekName} className={`${this.props.prefix}-calendar-week-item`}>{weekName}</li>
                    ))}
                </ul>

                <ul className={`${this.props.prefix}-calendar-grid`}>
                    {calendarDays.map((date) => {
                        const dateKey = this.toDateKey(date);
                        const isToday = dateKey === this.state.todayKey;
                        const isSelected = this.sameDate(date, selectedDate);
                        const isOtherMonth = date.getMonth() !== month;
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const specialDay = this.state.specialDaysByYear[date.getFullYear()]?.[dateKey];
                        const weatherItem = weatherByDate[dateKey];
                        const weatherMark = weatherItem ? this.getDayWeatherMark(weatherItem.weatherCode) : null;
                        const hasHoliday = Boolean(specialDay && specialDay.isOffDay);
                        const hasWorkday = Boolean(specialDay && !specialDay.isOffDay);
                        const isPlainWeekend = isWeekend && !hasHoliday && !hasWorkday;
                        const tagText = hasWorkday ? '\u73ed' : (hasHoliday ? '\u4f11' : '');
                        const holidayText = specialDay ? `${specialDay.name}${specialDay.isOffDay ? '(\u4f11)' : '(\u73ed)'}` : '';
                        const weatherText = weatherItem ? ` · ${weatherItem.weatherText} ${weatherItem.min}\u00b0~${weatherItem.max}\u00b0` : '';
                        const titleText = `${holidayText || dateKey}${weatherText}`;
                        const cellClasses = [
                            `${this.props.prefix}-calendar-cell`,
                            isOtherMonth ? `${this.props.prefix}-calendar-cell-other` : '',
                            isToday ? `${this.props.prefix}-calendar-cell-today` : '',
                            isSelected ? `${this.props.prefix}-calendar-cell-selected` : '',
                            isWeekend ? `${this.props.prefix}-calendar-cell-weekend` : '',
                            isPlainWeekend ? `${this.props.prefix}-calendar-cell-weekend-plain` : '',
                            hasHoliday ? `${this.props.prefix}-calendar-cell-holiday` : '',
                            hasWorkday ? `${this.props.prefix}-calendar-cell-workday` : '',
                        ].filter((className) => className).join(' ');

                        return (
                            <li key={dateKey} className={cellClasses}>
                                <button
                                    className={`${this.props.prefix}-calendar-day`}
                                    title={titleText}
                                    onClick={() => {
                                        const nextDate = this.stripTime(date);
                                        this.setState({
                                            selectedDate: nextDate,
                                            quickYear: nextDate.getFullYear(),
                                            quickMonth: nextDate.getMonth() + 1,
                                            quickDay: nextDate.getDate(),
                                        });
                                    }}
                                >
                                    <span className={`${this.props.prefix}-calendar-day-number`}>{date.getDate()}</span>
                                    <span className={`${this.props.prefix}-calendar-day-tag`}>{tagText}</span>
                                    {weatherMark ? (
                                        <span className={`${this.props.prefix}-calendar-weather-mark ${this.props.prefix}-calendar-weather-mark-${weatherMark.kind}`} title={weatherMark.text}>
                                            {weatherMark.icon}
                                        </span>
                                    ) : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>

                {/* 月份导航 - 移到今天按钮上方 */}
                <div className={`${this.props.prefix}-calendar-header ${this.props.prefix}-calendar-header-bottom`}>
                    <button
                        className={`${this.props.prefix}-calendar-btn`}
                        aria-label='Previous month'
                        onClick={() => { this.shiftMonth(-1); }}
                    >
                        {'◀'}
                    </button>
                    <span className={`${this.props.prefix}-calendar-title`}>{monthText}</span>
                    <button
                        className={`${this.props.prefix}-calendar-btn`}
                        aria-label='Next month'
                        onClick={() => { this.shiftMonth(1); }}
                    >
                        {'▶'}
                    </button>
                </div>

                <div className={`${this.props.prefix}-calendar-footer`}>
                    <div className={`${this.props.prefix}-calendar-info`}>
                        <span>{selectedKey}</span>
                        <span>{selectedWeekText}</span>
                        <span>{infoText}</span>
                    </div>
                    <button
                        className={`${this.props.prefix}-calendar-today`}
                        onClick={() => { this.jumpToToday(); }}
                    >
                        {'\u4eca\u5929'}
                    </button>
                </div>

                {statusText ? (
                    <div className={`${this.props.prefix}-calendar-status`}>{statusText}</div>
                ) : null}
            </div>
        );
    }
}

export default Calendar;
