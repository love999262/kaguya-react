// 日期工具函数 - 节气、节日、纪念日计算

import solarTermsData from '../../data/solar-terms.json';
import memorialDaysData from '../../data/memorial-days.json';

export interface SolarTerm {
    name: string;
    month: number;
    dayRange: number[];
    description: string;
    tips: string;
}

export interface MemorialDay {
    name: string;
    month: number;
    day: number | string;
    type: 'holiday' | 'festival' | 'traditional' | 'memorial';
    description: string;
    lunar?: boolean;
    approximate?: boolean;
}

export interface TodayInfo {
    solarTerm: SolarTerm | null;
    memorialDay: MemorialDay | null;
    isWeekend: boolean;
    weekDay: string;
}

// 获取今天是周几（中文）
export function getWeekDay(date: Date = new Date()): string {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return days[date.getDay()];
}

// 检查是否是周末
export function isWeekend(date: Date = new Date()): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}

// 获取某月第N个星期几的日期
export function getNthWeekday(year: number, month: number, weekday: number, n: number): number {
    const firstDay = new Date(year, month - 1, 1);
    let count = 0;
    
    for (let day = 1; day <= 31; day++) {
        const date = new Date(year, month - 1, day);
        if (date.getMonth() !== month - 1) break;
        
        if (date.getDay() === weekday) {
            count++;
            if (count === n) {
                return day;
            }
        }
    }
    
    return -1;
}

// 解析特殊日期格式（如"second-sunday"）
function parseSpecialDay(year: number, month: number, daySpec: string): number {
    const weekdayMap: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    const ordinalMap: Record<string, number> = {
        'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'last': -1
    };
    
    const parts = daySpec.split('-');
    if (parts.length === 2) {
        const ordinal = ordinalMap[parts[0]];
        const weekday = weekdayMap[parts[1]];
        
        if (ordinal && weekday !== undefined) {
            if (ordinal === -1) {
                // 最后一个星期几
                const lastDay = new Date(year, month, 0).getDate();
                for (let day = lastDay; day >= 1; day--) {
                    const date = new Date(year, month - 1, day);
                    if (date.getDay() === weekday) {
                        return day;
                    }
                }
            } else {
                return getNthWeekday(year, month, weekday, ordinal);
            }
        }
    }
    
    return -1;
}

// 获取今天的节气
export function getTodaySolarTerm(date: Date = new Date()): SolarTerm | null {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const solarTerms: SolarTerm[] = solarTermsData;
    
    // 查找匹配的节气
    const term = solarTerms.find(t => {
        if (t.month !== month) return false;
        return t.dayRange.includes(day);
    });
    
    return term || null;
}

// 获取今天的节日/纪念日
export function getTodayMemorialDay(date: Date = new Date()): MemorialDay | null {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const memorialDays: MemorialDay[] = memorialDaysData;
    
    // 查找匹配的节日
    const memorial = memorialDays.find(m => {
        if (m.month !== month) return false;
        
        if (typeof m.day === 'number') {
            return m.day === day;
        } else if (typeof m.day === 'string') {
            const specialDay = parseSpecialDay(year, month, m.day);
            return specialDay === day;
        }
        
        return false;
    });
    
    return memorial || null;
}

// 获取今天的所有信息
export function getTodayInfo(date: Date = new Date()): TodayInfo {
    return {
        solarTerm: getTodaySolarTerm(date),
        memorialDay: getTodayMemorialDay(date),
        isWeekend: isWeekend(date),
        weekDay: getWeekDay(date),
    };
}

// 获取节气描述文本
export function getSolarTermDescription(term: SolarTerm): string {
    return `${term.name} - ${term.description}`;
}

// 获取节日描述文本
export function getMemorialDayDescription(day: MemorialDay): string {
    return `${day.name} - ${day.description}`;
}

// 格式化今天的信息为角色台词
export function formatTodayForCharacter(
    info: TodayInfo,
    character: '22' | '33'
): string {
    const lines: string[] = [];
    
    // 根据角色性格调整语气
    if (character === '22') {
        // 22娘：元气活泼
        if (info.memorialDay) {
            lines.push(`今天是${info.memorialDay.name}哦！`);
            if (info.memorialDay.type === 'traditional') {
                lines.push(`传统节日要开心度过呀～`);
            } else if (info.memorialDay.type === 'holiday') {
                lines.push(`放假了吗？好好享受吧！`);
            }
        } else if (info.solarTerm) {
            lines.push(`今天是${info.solarTerm.name}呢！`);
            lines.push(`${info.solarTerm.tips}哦～`);
        } else if (info.isWeekend) {
            lines.push(`今天是${info.weekDay}！`);
            lines.push(`周末愉快呀～有什么计划吗？`);
        }
    } else {
        // 33娘：吐槽毒舌沉稳
        if (info.memorialDay) {
            lines.push(`今天是${info.memorialDay.name}。`);
            if (info.memorialDay.type === 'traditional') {
                lines.push(`又一个传统节日，记得吃该吃的。`);
            } else if (info.memorialDay.type === 'holiday') {
                lines.push(`法定假日，可以休息。`);
            }
        } else if (info.solarTerm) {
            lines.push(`今日${info.solarTerm.name}。`);
            lines.push(`${info.solarTerm.tips}。`);
        } else if (info.isWeekend) {
            lines.push(`今天是${info.weekDay}。`);
            lines.push(`周末了，别浪费在睡觉上。`);
        }
    }
    
    return lines.join('');
}

// 检查今天是否有特殊日子
export function hasSpecialDay(date: Date = new Date()): boolean {
    const info = getTodayInfo(date);
    return !!(info.solarTerm || info.memorialDay || info.isWeekend);
}

// 获取下一个节日信息
export function getNextMemorialDay(date: Date = new Date()): { day: MemorialDay; daysUntil: number } | null {
    const memorialDays: MemorialDay[] = memorialDaysData;
    const year = date.getFullYear();
    const currentMonth = date.getMonth() + 1;
    const currentDay = date.getDate();
    
    // 搜索未来30天内的节日
    for (let offset = 1; offset <= 30; offset++) {
        const checkDate = new Date(date);
        checkDate.setDate(checkDate.getDate() + offset);
        
        const memorial = getTodayMemorialDay(checkDate);
        if (memorial) {
            return {
                day: memorial,
                daysUntil: offset,
            };
        }
    }
    
    return null;
}

// 导出数据供其他模块使用
export { solarTermsData as SOLAR_TERMS, memorialDaysData as MEMORIAL_DAYS };
