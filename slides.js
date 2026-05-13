document.addEventListener("DOMContentLoaded", function() {
  var toc     = document.getElementById("table-of-contents");
  var content = document.getElementById("content");
  if (toc && content) { document.body.insertBefore(toc, content); }
  var titleEl = document.querySelector("h1.title");
  var titleDiv = null;
  if (titleEl && toc) {
    titleDiv = document.createElement("div");
    titleDiv.className = "sidebar-title";
    var titleSpan = document.createElement("span");
    titleSpan.textContent = titleEl.textContent;
    titleDiv.appendChild(titleSpan);
    toc.insertBefore(titleDiv, toc.firstChild);
  }
  var searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "sidebar-search";
  searchInput.placeholder = "Search…";
  if (titleDiv) { titleDiv.appendChild(searchInput); }
  else if (toc) { toc.insertBefore(searchInput, toc.querySelector("h2")); }

  var slides = Array.from(document.querySelectorAll(".outline-2, .outline-3"));
  if (!slides.length) return;

  var links = Array.from(document.querySelectorAll("#text-table-of-contents a"));

  function setActive(link) {
    if (!link) return;
    links.forEach(function(a) { a.classList.remove("active"); });
    link.classList.add("active");
    link.scrollIntoView({ block: "nearest" });
    document.querySelectorAll("#text-table-of-contents ul ul").forEach(function(ul) {
      ul.classList.remove("expanded");
    });
    var topLi = link.closest("#text-table-of-contents > ul > li");
    if (topLi) {
      var childUl = topLi.querySelector("ul");
      if (childUl) childUl.classList.add("expanded");
    }
  }

  function tocLinkFor(slide) {
    var h = slide.querySelector("h2, h3");
    if (!h || !h.id) return null;
    return document.querySelector("#text-table-of-contents a[href='#" + h.id + "']");
  }

  function nearestSlideIdx() {
    var cTop = content.getBoundingClientRect().top;
    var best = 0, bestDist = Infinity;
    for (var i = 0; i < slides.length; i++) {
      var d = Math.abs(slides[i].getBoundingClientRect().top - cTop);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  var currentIdx  = 0;
  var scrollTimer = null;

  var counter = document.createElement("div");
  counter.className = "slide-counter";
  document.body.appendChild(counter);
  function updateCounter() {
    counter.textContent = (currentIdx + 1) + " / " + slides.length;
  }

  var breadcrumb = document.createElement("div");
  breadcrumb.className = "slide-breadcrumb";
  document.body.appendChild(breadcrumb);
  function updateBreadcrumb() {
    var slide = slides[currentIdx];
    var h = slide.querySelector("h2, h3");
    if (!h) return;
    var parts = [];
    if (h.tagName === "H3") {
      var parent = slide.closest(".outline-2");
      if (parent) {
        var ph = parent.querySelector("h2");
        if (ph) parts.push(ph.textContent);
      }
    }
    parts.push(h.textContent);
    breadcrumb.textContent = parts.join(" » ");
  }

  function filterToc(query) {
    var q = query.toLowerCase().trim();
    var allLi = Array.from(document.querySelectorAll("#text-table-of-contents li"));
    if (!q) {
      allLi.forEach(function(li) { li.style.display = ""; });
      return;
    }
    allLi.forEach(function(li) {
      var a = li.querySelector("a");
      li.dataset.match = (a && a.textContent.toLowerCase().includes(q)) ? "1" : "0";
    });
    allLi.forEach(function(li) {
      var childMatch = Array.from(li.querySelectorAll("li")).some(function(c) { return c.dataset.match === "1"; });
      li.style.display = (li.dataset.match === "1" || childMatch) ? "" : "none";
    });
    document.querySelectorAll("#text-table-of-contents ul ul").forEach(function(ul) {
      var hasVisible = Array.from(ul.children).some(function(li) { return li.style.display !== "none"; });
      if (hasVisible) ul.classList.add("expanded");
    });
  }
  searchInput.addEventListener("input", function() { filterToc(searchInput.value); });
  searchInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      var q = searchInput.value.toLowerCase().trim();
      for (var i = 0; i < slides.length; i++) {
        var h = slides[i].querySelector("h2, h3");
        if (h && h.textContent.toLowerCase().includes(q)) { goTo(i); searchInput.blur(); break; }
      }
    }
    if (e.key === "Escape") { searchInput.value = ""; filterToc(""); searchInput.blur(); }
  });

  function syncToc() {
    currentIdx = nearestSlideIdx();
    setActive(tocLinkFor(slides[currentIdx]));
    updateCounter();
    updateBreadcrumb();
  }

  content.addEventListener("scrollend", syncToc);

  function goTo(idx) {
    currentIdx = Math.max(0, Math.min(idx, slides.length - 1));
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(syncToc, 1200);
    slides[currentIdx].scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(tocLinkFor(slides[currentIdx]));
    updateCounter();
    updateBreadcrumb();
  }

  document.addEventListener("keydown", function(e) {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); goTo(currentIdx + 1); }
    if (e.key === "ArrowUp"   || e.key === "PageUp")   { e.preventDefault(); goTo(currentIdx - 1); }
  });

  syncToc();
});
