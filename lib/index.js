'use strict';
const formatoid = require('formatoid');
const DATE_FORMAT1 = 'MMM D, YYYY',
    DATE_FORMAT2 = 'MMMM D';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function printDayCount(dayCount) {
    return `${dayCount} ${dayCount === 1 ? 'day' : 'days'}`;
}

const currentYear = new Date().getFullYear();
function autoFormateDate(dateInput) {
    const date = typeof dateInput == 'string' ? new Date(dateInput) : dateInput;
    const format = date.getFullYear() == currentYear ? DATE_FORMAT2 : DATE_FORMAT1;
    return formatoid(date, format);
}

function addTooltips(container) {
    const tooltip = document.createElement('div');
    tooltip.classList.add('day-tooltip');
    container.appendChild(tooltip);

    // Add mouse event listener to show & hide tooltip
    const days = container.querySelectorAll('.js-calendar-graph-svg rect.ContributionCalendar-day');
    days.forEach((day) => {
        day.addEventListener('mouseenter', (e) => {
            let contribCount = e.target.getAttribute('data-count');
            if (contribCount === '0') {
                contribCount = 'No contributions';
            } else if (contribCount === '1') {
                contribCount = '1 contribution';
            } else {
                contribCount = `${contribCount} contributions`;
            }
            const date = new Date(e.target.getAttribute('data-date'));
            const dateText = `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
            tooltip.innerHTML = `<strong>${contribCount}</strong> on ${dateText}`;
            tooltip.classList.add('is-visible');
            const size = e.target.getBoundingClientRect(),
                leftPos = size.left + window.pageXOffset - tooltip.offsetWidth / 2 + size.width / 2,
                topPos = size.bottom + window.pageYOffset - tooltip.offsetHeight - 2 * size.height;
            tooltip.style.top = `${topPos}px`;
            tooltip.style.left = `${leftPos}px`;
        });
        day.addEventListener('mouseleave', () => {
            tooltip.classList.remove('is-visible');
        });
    });
}

/**
 * GitHubCalendar
 * Brings the contributions calendar from GitHub (provided username) into your page.
 *
 * @name GitHubCalendar
 * @function
 * @param {String|HTMLElement} container The calendar container (query selector or the element itself).
 * @param {String} username The GitHub username.
 * @param {Object} options An object containing the following fields:
 *
 *    - `summary_text` (String): The text that appears under the calendar (defaults to: `"Summary of
 *      pull requests, issues opened, and commits made by <username>"`).
 *    - `proxy` (Function): A function that receives as argument the username (string) and should return a promise resolving the HTML content of the contributions page.
 *      The default is using @Bloggify's APIs.
 *    - `global_stats` (Boolean): If `false`, the global stats (total, longest and current streaks) will not be calculated and displayed. By default this is enabled.
 *    - `responsive` (Boolean): If `true`, the graph is changed to scale with the container. Custom CSS should be applied to the element to scale it appropriately. By default this is disabled.
 *    - `tooltips` (Boolean): If `true`, tooltips will be shown when hovered over calendar days. By default this is disabled.
 *    - `cache` (Number) The cache time in seconds.
 *
 * @return {Promise} A promise returned by the `fetch()` call.
 */
module.exports = function GitHubCalendar(container, username, options) {
    container = document.querySelector(container);

    options = options || {};
    options.summary_text =
        options.summary_text ||
        `Summary of pull requests, issues opened, and commits made by <a href="https://github.com/${username}" target="blank">@${username}</a>`;
    options.cache = (options.cache || 24 * 60 * 60) * 1000;

    if (options.global_stats === false) {
        container.style.minHeight = '175px';
    }

    const cacheKeys = {
        content: `gh_calendar_content.${username}`,
        expire_at: `gh_calendar_expire.${username}`,
    };

    options.proxy = (username) => {
        return fetch(`https://api.rigle.co/github-streak/graph/${username}`).then((r) => r.text());
    };

    options.getCalendar =
        options.getCalendar ||
        ((username) => {
            if (options.cache && Date.now() < +localStorage.getItem(cacheKeys.expire_at)) {
                const content = localStorage.getItem(cacheKeys.content);
                if (content) {
                    return Promise.resolve(content);
                }
            }

            return options.proxy(username).then((body) => {
                if (options.cache) {
                    localStorage.setItem(cacheKeys.content, body);
                    localStorage.setItem(cacheKeys.expire_at, Date.now() + options.cache);
                }
                return body;
            });
        });

    const fetchGitHubStreakStats = async (username, parsed = null) => {
        try {
            const res = await fetch(`https://api.rigle.co/github-streak/stats/${username}`);
            const stats = res ? await res.json() : undefined;
            if (stats.totalContributions > 0) {
                return stats;
            }
        } catch (e) {
            //
        }
        if (!parsed) {
            return null;
        }
        return {
            totalContributions: parsed.last_year,
            firstContribution: null,
            longestStreak: {
                start: parsed.longest_streak ? parsed.longest_streak_range[0] : null,
                end: parsed.longest_streak ? parsed.longest_streak_range[1] : null,
                days: parsed.longest_streak,
            },
            currentStreak: {
                start: parsed.current_streak ? parsed.current_streak[0] : null,
                end: parsed.current_streak ? parsed.current_streak[1] : null,
                days: parsed.current_streak,
            },
        };
    };

    let makeElement = (tag, options) => {
        let el = document.createElement(tag);
        let classes = options.class?.split?.(' ');
        for (const _class of classes) {
            el.classList.add(_class);
        }
        el.innerHTML = options.html;
        return el;
    };

    let fetchCalendar = () =>
        options
            .getCalendar(username)
            .then(async (svgGraph) => {
                let svgGraphEl = document.createElement('div');
                svgGraphEl.classList.add('calendar-graph');
                svgGraphEl.innerHTML = svgGraph;

                container.innerHTML = '';
                container.appendChild(svgGraphEl);

                if (options.global_stats !== false) {
                    const streakStats = await fetchGitHubStreakStats(username);
                    let currentStreakInfo = streakStats.currentStreak.days
                        ? `${autoFormateDate(streakStats.currentStreak.start)} &ndash; ${autoFormateDate(
                              streakStats.currentStreak.end,
                          )}`
                        : parsed.last_contributed
                        ? `Last contributed on ${formatoid(parsed.last_contributed, DATE_FORMAT2)}.`
                        : 'Rock - Hard Place';

                    let longestStreakInfo = streakStats.longestStreak.days
                        ? `${autoFormateDate(streakStats.longestStreak.start)} &ndash; ${autoFormateDate(
                              streakStats.longestStreak.end,
                          )}`
                        : parsed.last_contributed
                        ? `Last contributed on ${formatoid(parsed.last_contributed, DATE_FORMAT2)}.`
                        : 'Rock - Hard Place';

                    let firstCol = makeElement('div', {
                        class: 'contrib-column contrib-column-first table-column',
                        html: `<span class="text-muted">Total contributions</span>
                               <span class="contrib-number">${streakStats.totalContributions} total</span>
                               <span class="text-muted">${autoFormateDate(
                                   streakStats.firstContribution,
                               )} &ndash; Present</span>`,
                    });
                    let secondCol = makeElement('div', {
                        class: 'contrib-column table-column',
                        html: `<span class="text-muted">Longest streak</span>
                               <span class="contrib-number">${printDayCount(streakStats.longestStreak.days)}</span>
                               <span class="text-muted">${longestStreakInfo}</span>`,
                    });
                    let thirdCol = makeElement('div', {
                        class: 'contrib-column table-column',
                        html: `<span class="text-muted">Current streak</span>
                               <span class="contrib-number">${printDayCount(streakStats.currentStreak.days)}</span>
                               <span class="text-muted">${currentStreakInfo}</span>`,
                    });

                    container.appendChild(firstCol);
                    container.appendChild(secondCol);
                    container.appendChild(thirdCol);
                }

                // If options includes tooltips, add tooltips listeners to SVG
                if (options.tooltips === true) {
                    addTooltips(container);
                }
            })
            .catch((e) => console.error(e));

    return fetchCalendar();
};
