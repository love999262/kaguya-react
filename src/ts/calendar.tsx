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
}

const WEEK_TEXT = ['\u5468\u4e00', '\u5468\u4e8c', '\u5468\u4e09', '\u5468\u56db', '\u5468\u4e94', '\u5468\u516d', '\u5468\u65e5'];
const WEEK_TEXT_FULL = ['\u5468\u65e5', '\u5468\u4e00', '\u5468\u4e8c', '\u5468\u4e09', '\u5468\u56db', '\u5468\u4e94', '\u5468\u516d'];
const WEEK_TEXT_SHORT = ['\u65e5', '\u4e00', '\u4e8c', '\u4e09', '\u56db', '\u4e94', '\u516d'];
const WEATHER_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const WEATHER_FORECAST_TARGET_DAYS = 16;

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

    private getDayWeatherAlert(code: number): { icon: string; kind: 'rain' | 'snow' | 'extreme'; text: string; } | null {
        if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
            return { icon: '\ud83c\udf27\ufe0f', kind: 'rain', text: '\u964d\u96e8' };
        }
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
            return { icon: '\u2744\ufe0f', kind: 'snow', text: '\u964d\u96ea' };
        }
        if (code >= 95) {
            return { icon: '\u26C8\ufe0f', kind: 'extreme', text: '\u5f3a\u5bf9\u6d41' };
        }
        return null;
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

    private buildWeatherUrl(location: WeatherLocation, forecastDays: number): string {
        const params = new URLSearchParams({
            latitude: `${location.latitude}`,
            longitude: `${location.longitude}`,
            timezone: 'auto',
            forecast_days: `${forecastDays}`,
            daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        });
        return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    }

    private normalizeAreaText(value: string): string {
        return value.replace(/\s+/g, '').trim();
    }

    private async reverseGeocodeToCounty(latitude: number, longitude: number): Promise<string | null> {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            controller.abort();
        }, 4500);

        try {
            const endpoint = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh-Hans`;
            const response = await fetch(endpoint, { signal: controller.signal });
            if (!response.ok) {
                return null;
            }
            const payload = await response.json() as ReverseGeoResponse;
            const province = typeof payload.principalSubdivision === 'string' ? this.normalizeAreaText(payload.principalSubdivision) : '';
            const locality = typeof payload.locality === 'string' ? this.normalizeAreaText(payload.locality) : '';
            const city = typeof payload.city === 'string' ? this.normalizeAreaText(payload.city) : '';

            if (province && locality) {
                return province.includes(locality) ? province : `${province}${locality}`;
            }
            if (province && city) {
                return province.includes(city) ? province : `${province}${city}`;
            }
            if (city && locality) {
                return city.includes(locality) ? city : `${city}${locality}`;
            }
            if (locality) {
                return locality;
            }
            return province || city || null;
        } catch {
            return null;
        } finally {
            window.clearTimeout(timer);
        }
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

        const areaLabel = await this.reverseGeocodeToCounty(coordinates.latitude, coordinates.longitude);
        const location: WeatherLocation = {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            label: areaLabel || `\u5f53\u524d\u4f4d\u7f6e (${coordinates.latitude.toFixed(2)}, ${coordinates.longitude.toFixed(2)})`,
            isFallback: false,
        };
        this.resolvedWeatherLocation = location;
        return location;
    }

    private async fetchWeeklyWeather() {
        this.setState({ weatherLoading: true, weatherError: false });
        try {
            const location = await this.resolveWeatherLocation();
            const locationText = location.isFallback
                ? `${location.label}\uff08\u9ed8\u8ba4\uff09`
                : location.label;
            const targetDays = WEATHER_FORECAST_TARGET_DAYS;
            const response = await fetch(this.buildWeatherUrl(location, targetDays));
            if (!response.ok) {
                throw new Error(`weather api failed: ${response.status}`);
            }

            const data = await response.json() as WeatherResponse;
            const days = data.daily?.time ?? [];
            const codes = data.daily?.weather_code ?? [];
            const maxList = data.daily?.temperature_2m_max ?? [];
            const minList = data.daily?.temperature_2m_min ?? [];

            if (!days.length || !codes.length || !maxList.length || !minList.length) {
                throw new Error('weather payload invalid');
            }

            const forecastLimit = Math.min(targetDays, days.length);

            const weeklyWeather = days.slice(0, forecastLimit).map((dateKey: string, index: number) => {
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

            const extremeAlerts: ExtremeWeatherAlertItem[] = [];
            weeklyWeather.forEach((item) => {
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
            this.postExtremeWeatherMessage(locationText, weeklyWeather.length, extremeAlerts);

            this.setState({
                weeklyWeather,
                weatherLoading: false,
                weatherError: false,
                weatherLocationLabel: locationText,
                weatherForecastDays: weeklyWeather.length,
            });
        } catch {
            this.setState({ weatherLoading: false, weatherError: true });
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
        const quickDaysMax = this.getDaysInMonth(this.state.quickYear, this.state.quickMonth);
        const yearOptions = this.getYearOptions();
        const liveTimeText = this.formatTime(this.state.now);
        const weatherByDate: Record<string, WeeklyWeatherItem> = {};
        this.state.weeklyWeather.forEach((item) => {
            weatherByDate[item.dateKey] = item;
        });

        return (
            <div className={`${this.props.prefix}-calendar`}>
                <div className={`${this.props.prefix}-calendar-header`}>
                    <button
                        className={`${this.props.prefix}-calendar-btn`}
                        aria-label='Previous month'
                        onClick={() => { this.shiftMonth(-1); }}
                    >
                        {'<'}
                    </button>
                    <span className={`${this.props.prefix}-calendar-title`}>{monthText}</span>
                    <button
                        className={`${this.props.prefix}-calendar-btn`}
                        aria-label='Next month'
                        onClick={() => { this.shiftMonth(1); }}
                    >
                        {'>'}
                    </button>
                </div>

                <div className={`${this.props.prefix}-calendar-live-time`}>{liveTimeText}</div>

                <div className={`${this.props.prefix}-calendar-weather`}>
                    {this.state.weatherLoading ? (
                        <div className={`${this.props.prefix}-calendar-weather-loading`}>
                            {'\u5929\u6c14\u52a0\u8f7d\u4e2d...'}
                        </div>
                    ) : (
                        this.state.weeklyWeather.slice(0, 7).map((item) => (
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
                    {`\u5929\u6c14\u5b9a\u4f4d\uff1a${this.state.weatherLocationLabel} \u00b7 \u9884\u62a5${this.state.weatherForecastDays}\u5929`}
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
                        const weatherAlert = weatherItem ? this.getDayWeatherAlert(weatherItem.weatherCode) : null;
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
                                    {weatherAlert ? (
                                        <span className={`${this.props.prefix}-calendar-weather-mark ${this.props.prefix}-calendar-weather-mark-${weatherAlert.kind}`} title={weatherAlert.text}>
                                            {weatherAlert.icon}
                                        </span>
                                    ) : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>

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

                <div className={`${this.props.prefix}-calendar-status`}>
                    {this.state.weatherError ? '\u5929\u6c14\u63a5\u53e3\u6682\u4e0d\u53ef\u7528\uff0c\u5df2\u4f7f\u7528\u4e0a\u6b21\u6570\u636e\u3002' : ''}
                    {isYearLoading ? ' \u5047\u65e5\u4e0e\u8c03\u4f11\u6570\u636e\u52a0\u8f7d\u4e2d...' : ''}
                    {!isYearLoading && isYearError ? ' \u8282\u5047\u65e5\u63a5\u53e3\u4e0d\u53ef\u7528\uff0c\u5df2\u56de\u9000\u666e\u901a\u65e5\u5386\u3002' : ''}
                    {!isYearLoading && !isYearError ? ' \u6807\u8bb0\u8bf4\u660e\uff1a\u4f11=\u6cd5\u5b9a\u4f11\uff0c\u73ed=\u8c03\u4f11\u4e0a\u73ed' : ''}
                </div>
            </div>
        );
    }
}

export default Calendar;
