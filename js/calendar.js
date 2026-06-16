(() => {
  "use strict";

  const calendar = document.getElementById("broadcastCalendar");
  const monthTitle = document.getElementById("calendarMonthTitle");
  const selectedEvent = document.getElementById("calendarSelectedEvent");
  const prevButton = document.getElementById("calendarPrevMonth");
  const nextButton = document.getElementById("calendarNextMonth");

  if (!calendar || !monthTitle || !selectedEvent) {
    return;
  }

  let events = [];
  let viewDate = new Date();
  viewDate.setDate(1);

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getEventTypeClass(type) {
    const valid = ["dayoff", "special", "timechange", "collab"];

    return valid.includes(type)
      ? `type-${type}`
      : "type-special";
  }

  function renderSelected(item) {
    if (!item) {
      selectedEvent.innerHTML = `
        <strong>일정 안내</strong>
        <p>표시된 날짜를 선택하면 상세 내용을 확인할 수 있습니다.</p>
      `;
      return;
    }

    selectedEvent.innerHTML = `
      <strong>${item.date} · ${item.title || "방송 일정"}</strong>
      <p>${item.description || "상세 내용이 없습니다."}</p>
    `;
  }

  function render() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    monthTitle.textContent = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - firstDay.getDay());
    const todayKey = dateKey(new Date());

    const eventMap = new Map();

    events.forEach((item) => {
      if (item.visible === false || !item.date) {
        return;
      }

      if (!eventMap.has(item.date)) {
        eventMap.set(item.date, []);
      }

      eventMap.get(item.date).push(item);
    });

    calendar.innerHTML = `
      <div class="calendar-weekdays">
        <span>일</span>
        <span>월</span>
        <span>화</span>
        <span>수</span>
        <span>목</span>
        <span>금</span>
        <span>토</span>
      </div>
      <div class="calendar-days" id="calendarDays"></div>
    `;

    const days = calendar.querySelector("#calendarDays");

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);

      const key = dateKey(date);
      const dayEvents = eventMap.get(key) || [];
      const hasEvent = dayEvents.length > 0;
      const element = document.createElement(hasEvent ? "button" : "div");

      element.className = "calendar-day";
      element.textContent = date.getDate();

      if (date.getMonth() !== month) {
        element.classList.add("other-month");
      }

      if (key === todayKey) {
        element.classList.add("today");
      }

      if (hasEvent) {
        element.type = "button";
        element.classList.add(
          "has-event",
          getEventTypeClass(dayEvents[0].type)
        );

        element.title = dayEvents
          .map((item) => item.title || "방송 일정")
          .join(", ");

        element.addEventListener("click", () => {
          calendar
            .querySelectorAll(".calendar-day.selected")
            .forEach((item) => item.classList.remove("selected"));

          element.classList.add("selected");
          renderSelected(dayEvents[0]);
        });
      }

      days.appendChild(element);
    }
  }

  prevButton?.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    render();
  });

  nextButton?.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    render();
  });

  window.addEventListener("kkokko:schedule-loaded", (event) => {
    events = Array.isArray(event.detail) ? event.detail : [];
    render();
  });

  render();
})();
