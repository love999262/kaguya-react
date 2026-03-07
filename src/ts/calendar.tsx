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
}

const WEEK_TEXT = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEK_TEXT_FULL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

class Calendar extends React.Component <Props, StateInterface> {
    private timer: number | null;

    constructor(props: Props, context: any) {
        super(props, context);
        const today = this.stripTime(new Date());
        this.timer = null;
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
                return { now };
            });
        }, 1000);
        this.fetchYearHolidays(this.state.displayMonth.getFullYear());
    }

    componentWillUnmount() {
        if (this.timer !== null) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
    }

    componentDidUpdate(prevProps: Props, prevState: StateInterface) {
        const currentYear = this.state.displayMonth.getFullYear();
        const previousYear = prevState.displayMonth.getFullYear();
        if (currentYear !== previousYear) {
            this.fetchYearHolidays(currentYear);
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

    private async fetchYearHolidays(year: number) {
        if (this.state.specialDaysByYear[year] || this.state.loadingByYear[year]) {
            return;
        }

        this.setState((prevState) => {
            return {
                loadingByYear: { ...prevState.loadingByYear, [year]: true },
                errorByYear: { ...prevState.errorByYear, [year]: false },
            };
        });

        try {
            const endpointList = [
                `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
                `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`,
            ];

            let data: HolidayCnYearResponse | null = null;
            for (let index = 0; index < endpointList.length; index++) {
                const endpoint = endpointList[index];
                try {
                    const response = await fetch(endpoint);
                    if (!response.ok) {
                        continue;
                    }
                    const parsed = await response.json() as HolidayCnYearResponse;
                    if (parsed && Array.isArray(parsed.days)) {
                        data = parsed;
                        break;
                    }
                } catch (fetchError) {
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
                    name: item.name.trim() || '节假日',
                    isOffDay: item.isOffDay,
                };
            });

            this.setState((prevState) => {
                return {
                    specialDaysByYear: { ...prevState.specialDaysByYear, [year]: specialDayMap },
                    loadingByYear: { ...prevState.loadingByYear, [year]: false },
                    errorByYear: { ...prevState.errorByYear, [year]: false },
                };
            });
        } catch (error) {
            this.setState((prevState) => {
                return {
                    loadingByYear: { ...prevState.loadingByYear, [year]: false },
                    errorByYear: { ...prevState.errorByYear, [year]: true },
                };
            });
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
        const monthText = `${year}年${month + 1}月`;
        const calendarDays = this.getMonthGrid(displayMonth);
        const selectedKey = this.toDateKey(selectedDate);
        const selectedSpecialDay = this.state.specialDaysByYear[selectedDate.getFullYear()]?.[selectedKey];
        const isSelectedWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
        const isYearLoading = this.state.loadingByYear[year];
        const isYearError = this.state.errorByYear[year];
        const selectedWeekText = WEEK_TEXT_FULL[selectedDate.getDay()];
        const infoText = selectedSpecialDay
            ? `${selectedSpecialDay.isOffDay ? '休' : '班'} · ${selectedSpecialDay.name}`
            : (isSelectedWeekend ? '周末' : '工作日');
        const quickDaysMax = this.getDaysInMonth(this.state.quickYear, this.state.quickMonth);
        const yearOptions = this.getYearOptions();
        const liveTimeText = this.formatTime(this.state.now);

        return (
            <div className={`${this.props.prefix}-calendar`}>
                <div className={`${this.props.prefix}-calendar-header`}>
                    <button
                        className={`${this.props.prefix}-calendar-btn`}
                        aria-label='Previous month'
                        onClick={() => { this.shiftMonth(-1); }}
                    >
                        ‹
                    </button>
                    <span className={`${this.props.prefix}-calendar-title`}>{monthText}</span>
                    <button
                        className={`${this.props.prefix}-calendar-btn`}
                        aria-label='Next month'
                        onClick={() => { this.shiftMonth(1); }}
                    >
                        ›
                    </button>
                </div>
                <div className={`${this.props.prefix}-calendar-live-time`}>{liveTimeText}</div>
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
                            <option key={yearOption} value={yearOption}>{yearOption}年</option>
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
                            <option key={monthOption} value={monthOption}>{monthOption}月</option>
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
                            <option key={dayOption} value={dayOption}>{dayOption}日</option>
                        ))}
                    </select>
                    <button
                        className={`${this.props.prefix}-calendar-go`}
                        onClick={() => { this.jumpToQuickDate(); }}
                    >
                        跳转
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
                        const hasHoliday = Boolean(specialDay && specialDay.isOffDay);
                        const hasWorkday = Boolean(specialDay && !specialDay.isOffDay);
                        const isPlainWeekend = isWeekend && !hasHoliday && !hasWorkday;
                        const tagText = hasWorkday ? '班' : (hasHoliday ? '休' : '');
                        const titleText = specialDay ? `${specialDay.name}${specialDay.isOffDay ? '（休）' : '（班）'}` : dateKey;
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
                                    <span className={`${this.props.prefix}-calendar-day-tag`}>
                                        {tagText}
                                    </span>
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
                        今天
                    </button>
                </div>
                <div className={`${this.props.prefix}-calendar-status`}>
                    {isYearLoading ? '节假日与调休数据加载中...' : ''}
                    {!isYearLoading && isYearError ? '第三方接口不可用，已回退普通日历' : ''}
                    {!isYearLoading && !isYearError ? '标记说明: 休=法定休息, 班=调休上班' : ''}
                </div>
            </div>
        );
    }
}

export default Calendar;
