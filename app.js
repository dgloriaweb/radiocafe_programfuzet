const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const dayNames = {
  Monday: "Hétfő",
  Tuesday: "Kedd",
  Wednesday: "Szerda",
  Thursday: "Csütörtök",
  Friday: "Péntek",
  Saturday: "Szombat",
  Sunday: "Vasárnap",
};

function getBudapestNowParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Budapest",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    weekday: map.weekday, // e.g. "Monday"
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function isInOfflinePeriod(offlinePeriods) {
  if (!offlinePeriods || offlinePeriods.length === 0) return null;

  const nowParts = getBudapestNowParts();
  const currentYear = nowParts.year;
  const currentMonth = nowParts.month;
  const currentDay = nowParts.day;
  const currentKey = currentMonth * 100 + currentDay;

  for (const period of offlinePeriods) {
    const [fromMonth, fromDay] = period.from.split("-").map(Number);
    const [toMonth, toDay] = period.to.split("-").map(Number);
    const fromKey = fromMonth * 100 + fromDay;
    const toKey = toMonth * 100 + toDay;

    const wrapsYear = fromKey > toKey;
    const inPeriod = wrapsYear
      ? currentKey >= fromKey || currentKey <= toKey
      : currentKey >= fromKey && currentKey <= toKey;

    if (inPeriod) {
      const endYear = wrapsYear && currentKey >= fromKey ? currentYear + 1 : currentYear;
      const endDateTime = `${endYear}-${String(toMonth).padStart(2, "0")}-${String(toDay).padStart(2, "0")} 23:59`;

      return {
        reason: period.reason,
        endDateTime,
      };
    }
  }

  return null;
}

async function loadSchedule() {
  try {
    const response = await fetch("radiocafe_shows.json");
    const shows = await response.json();

    const scheduleContainer = document.getElementById("schedule");

    days.forEach((day) => {
      const daySection = document.createElement("div");
      daySection.className = "day-section";
      daySection.id = `day-${day}`;

      const dayTitle = document.createElement("h2");
      dayTitle.className = "day-title";
      dayTitle.textContent = dayNames[day];
      daySection.appendChild(dayTitle);

      const dayShows = [];

      shows.forEach((show) => {
        show.broadcasts.forEach((broadcast) => {
          if (broadcast.day === day && broadcast.is_main_air_time) {
            dayShows.push({
              ...show,
              time: broadcast.start_time,
              endTime: broadcast.end_time,
              isLive: broadcast.expected_live,
            });
          }
        });
      });

      dayShows.sort((a, b) => {
        const timeA = a.time.split(":").map(Number);
        const timeB = b.time.split(":").map(Number);
        return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
      });

      if (dayShows.length === 0) {
        const noShows = document.createElement("div");
        noShows.className = "no-shows";
        noShows.textContent = "Nincs műsor ezen a napon";
        daySection.appendChild(noShows);
      } else {
        dayShows.forEach((show) => {
          const showCard = document.createElement("div");
          showCard.className = "show-card";

          const timeStr = show.endTime ? `${show.time} - ${show.endTime}` : show.time;

          const offlineInfo = isInOfflinePeriod(show.offline_periods);

          let badges = "";
          if (offlineInfo) {
            badges += `<span class="badge badge-offline">${offlineInfo.reason} - ${offlineInfo.endDateTime}-ig</span>`;
          } else {
            if (show.isLive) {
              badges += '<span class="badge badge-live">ÉLŐ</span>';
            }
          }
          if (show.is_podcast) {
            badges += '<span class="badge badge-podcast">PODCAST</span>';
          }

          const presenters =
            show.presenters && show.presenters.length > 0
              ? `<div class="show-presenters">Műsorvezetők: ${show.presenters.join(", ")}</div>`
              : "";

          showCard.innerHTML = `
            <div class="show-time">${timeStr}${badges}</div>
            <div class="show-title">${show.show}</div>
            <div class="details-toggle">Részletek...</div>
            <div class="show-details">
              ${presenters}
              <div class="show-description">${show.description_hu}</div>
            </div>
          `;

          showCard.addEventListener("click", () => {
            showCard.classList.toggle("expanded");
          });

          daySection.appendChild(showCard);
        });
      }

      scheduleContainer.appendChild(daySection);
    });

    setupDayButtons();
  } catch (error) {
    console.error("Hiba a műsorprogram betöltésekor:", error);
    document.getElementById("schedule").innerHTML =
      '<div class="day-section"><p class="no-shows">Hiba történt a műsorprogram betöltésekor.</p></div>';
  }
}

function setupDayButtons() {
  const dayButtons = document.querySelectorAll(".day-btn");
  let isUserScrolling = true;

  dayButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetDay = button.getAttribute("data-day");
      const targetSection = document.getElementById(`day-${targetDay}`);

      if (targetSection) {
        dayButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");

        isUserScrolling = false;
        targetSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        setTimeout(() => {
          isUserScrolling = true;
        }, 1000);
      }
    });
  });

  function updateActiveButton() {
    if (!isUserScrolling) return;

    const sections = document.querySelectorAll(".day-section");
    const scrollPosition = window.scrollY + window.innerHeight / 2;

    let closestSection = null;
    let closestDistance = Infinity;

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionMiddle = sectionTop + section.offsetHeight / 2;
      const distance = Math.abs(scrollPosition - sectionMiddle);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestSection = section;
      }
    });

    if (closestSection) {
      const day = closestSection.id.replace("day-", "");
      dayButtons.forEach((btn) => {
        if (btn.getAttribute("data-day") === day) {
          dayButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
        }
      });
    }
  }

  let scrollTimeout;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(updateActiveButton, 50);
  });
  updateActiveButton();
}

function updateNowPlaying() {
  const nowParts = getBudapestNowParts();
  const currentDay = nowParts.weekday; // "Monday"..."Sunday" in Europe/Budapest time
  const currentTimeMinutes = nowParts.hour * 60 + nowParts.minute;

  fetch("radiocafe_shows.json")
    .then((response) => response.json())
    .then((shows) => {
      let currentShow = null;

      for (const show of shows) {
        for (const broadcast of show.broadcasts) {
          if (broadcast.day === currentDay && broadcast.is_main_air_time) {
            const [startHour, startMin] = broadcast.start_time.split(":").map(Number);
            const startTimeMinutes = startHour * 60 + startMin;

            let endTimeMinutes;
            if (broadcast.end_time) {
              const [endHour, endMin] = broadcast.end_time.split(":").map(Number);
              endTimeMinutes = endHour * 60 + endMin;
            } else {
              endTimeMinutes = startTimeMinutes + 60;
            }

            if (currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes) {
              const offlineInfo = isInOfflinePeriod(show.offline_periods);
              if (!offlineInfo) {
                currentShow = {
                  ...show,
                  time: broadcast.start_time,
                  endTime: broadcast.end_time,
                };
                break;
              }
            }
          }
        }
        if (currentShow) break;
      }

      const content = document.getElementById("nowPlayingContent");
      if (currentShow) {
        const timeStr = currentShow.endTime
          ? `${currentShow.time} - ${currentShow.endTime}`
          : currentShow.time;

        const presenters =
          currentShow.presenters && currentShow.presenters.length > 0
            ? `<div class="now-playing-presenters">${currentShow.presenters.join(", ")}</div>`
            : "";

        content.innerHTML = `
          <div class="now-playing-show">${currentShow.show}</div>
          <div class="now-playing-time">${timeStr}</div>
          ${presenters}
        `;
      } else {
        content.innerHTML = '<div class="now-playing-show">Zene</div>';
      }
    });
}

document.getElementById("closeNowPlaying").addEventListener("click", () => {
  document.getElementById("nowPlaying").classList.add("hidden");
});

// Always show after refresh; close only hides for current page session.
updateNowPlaying();
setInterval(updateNowPlaying, 60000);

loadSchedule();
