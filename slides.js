if ("scrollRestoration" in history) history.scrollRestoration = "manual";

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
    titleDiv.addEventListener("click", function() { goTo(0, true); });
  }
  var searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "sidebar-search";
  searchInput.placeholder = "Search…";
  if (titleDiv) { titleDiv.appendChild(searchInput); }
  else if (toc) { toc.insertBefore(searchInput, toc.querySelector("h2")); }

  // --- Auto-generate title slide from preamble ---
  (function() {
    var firstOutline = content && content.querySelector(":scope > .outline-2, :scope > .outline-3");
    if (!firstOutline) return;
    var titleSlide = document.createElement("div");
    titleSlide.className = "outline-2";
    titleSlide.id = "org-title-slide";
    var notesDiv = document.createElement("div");
    notesDiv.className = "outline-text-2";
    while (content.firstChild !== firstOutline) {
      var n = content.firstChild;
      if (n.nodeType === 1 && n.tagName.toLowerCase() === "aside") {
        notesDiv.appendChild(n);
      } else {
        titleSlide.appendChild(n);
      }
    }
    titleSlide.appendChild(notesDiv);
    content.insertBefore(titleSlide, firstOutline);

    // Pull p.author from #postamble into title slide
    var postamble = document.getElementById("postamble");
    if (postamble) {
      var authorP = postamble.querySelector("p.author");
      if (authorP) {
        authorP.textContent = authorP.textContent.replace(/^Author:\s*/, "");
        titleSlide.insertBefore(authorP, notesDiv);
      }
    }
  })();

  var slides = Array.from(document.querySelectorAll(".outline-2, .outline-3"));
  if (!slides.length) return;

  var links = Array.from(document.querySelectorAll("#text-table-of-contents a"));

  // Force scroll to top after JS inserts the title slide
  content.scrollTo({ top: 0, behavior: "instant" });

  // --- Presenter mode ---
  var isPresenter = location.search.indexOf("presenter") !== -1;

  // --- localStorage sync (works across file:// tabs) ---
  var SYNC_KEY = "org-slides-sync";
  var receiving = false;

  window.addEventListener("storage", function(e) {
    if (e.key !== SYNC_KEY || !e.newValue) return;
    var msg = JSON.parse(e.newValue);
    var targetIdx = Math.max(0, Math.min(msg.idx, slides.length - 1));
    var targetStep = Math.max(0, msg.stepIdx || 0);
    receiving = true;
    goTo(targetIdx, false);
    var steps = getSteps(slides[currentIdx]);
    steps.forEach(function(s, i) {
      if (i < targetStep) s.classList.remove("step-hidden");
      else s.classList.add("step-hidden");
    });
    stepIdx = targetStep;
    if (isPresenter) {
      updatePresenterPanel();
    } else {
      if (msg.zoomed && !zoomed) {
        var zSteps = getSteps(slides[currentIdx]);
        var zEl = stepIdx > 0 ? zSteps[stepIdx - 1] : null;
        if (zEl && isZoomable(zEl)) { zoomed = true; openModal(zEl); }
      } else if (!msg.zoomed && zoomed) {
        zoomed = false; closeModal();
      }
      updateCounter();
      clearTimeout(scrollTimer);
      scrollTimer = null;
      slides[currentIdx].scrollIntoView({ behavior: "instant", block: "start" });
    }
    receiving = false;
  });

  function broadcast() {
    if (!receiving) {
      localStorage.setItem(SYNC_KEY,
        JSON.stringify({ idx: currentIdx, stepIdx: stepIdx, zoomed: zoomed, ts: Date.now() }));
    }
  }

  // --- Presenter panel ---
  var presenterPanel = null;
  var pnlTitle, pnlNotes, pnlNext, pnlCounter;

  function noteAfterStep(step) {
    var container = step.matches("li") ? step.parentElement : step;
    var next = container.nextElementSibling;
    return (next && next.matches("aside.notes, aside.NOTES")) ? next : null;
  }

  function updatePresenterPanel() {
    if (!presenterPanel) return;
    var slide = slides[currentIdx];
    var h = slide.querySelector("h2, h3");
    pnlTitle.textContent = h ? h.textContent : "";

    pnlNotes.innerHTML = "";
    var steps = getSteps(slide);
    if (!steps.length) {
      // Slide with no steps: show all notes directly
      var area = slide.querySelector(".outline-text-2, .outline-text-3");
      if (area) {
        area.querySelectorAll(":scope > aside.notes, :scope > aside.NOTES").forEach(function(n) {
          var el = document.createElement("div");
          el.className = "pnl-note-inline";
          el.innerHTML = n.innerHTML;
          pnlNotes.appendChild(el);
        });
      }
    } else {
      // Notes before the first step (shown immediately on slide entry)
      var area = slide.querySelector(".outline-text-2, .outline-text-3");
      var preNotes = [];
      if (area && steps.length) {
        var firstStepContainer = steps[0].parentElement === area ? steps[0] : steps[0].parentElement;
        var node = area.firstElementChild;
        while (node && node !== firstStepContainer) {
          if (node.matches("aside.notes, aside.NOTES")) preNotes.push(node);
          node = node.nextElementSibling;
        }
      }
      preNotes.forEach(function(n) {
        var el = document.createElement("div");
        el.className = "pnl-note-inline";
        el.innerHTML = n.innerHTML;
        pnlNotes.appendChild(el);
      });

      steps.slice(0, stepIdx).forEach(function(step) {
        var note = noteAfterStep(step);
        if (note) {
          var noteEl = document.createElement("div");
          noteEl.className = "pnl-note-inline";
          noteEl.innerHTML = note.innerHTML;
          pnlNotes.appendChild(noteEl);
        }
      });
      if (stepIdx === 0 && preNotes.length === 0) {
        var placeholder = document.createElement("em");
        placeholder.style.color = "#556";
        placeholder.textContent = "→ 右矢印でスタート";
        pnlNotes.appendChild(placeholder);
      }
    }

    var next = slides[currentIdx + 1];
    if (next) {
      var nh = next.querySelector("h2, h3");
      pnlNext.textContent = "Next: " + (nh ? nh.textContent : "");
      pnlNext.style.display = "";
    } else {
      pnlNext.style.display = "none";
    }
    pnlCounter.textContent = (currentIdx + 1) + " / " + slides.length +
      (steps.length ? "  (" + stepIdx + "/" + steps.length + ")" : "");
  }

  if (isPresenter) {
    document.body.classList.add("presenter");
    presenterPanel = document.createElement("div");
    presenterPanel.className = "presenter-panel";
    pnlTitle   = document.createElement("div"); pnlTitle.className   = "pnl-title";
    pnlNotes   = document.createElement("div"); pnlNotes.className   = "pnl-notes";
    pnlNext    = document.createElement("div"); pnlNext.className    = "pnl-next";
    pnlCounter = document.createElement("div"); pnlCounter.className = "pnl-counter";
    presenterPanel.appendChild(pnlTitle);
    presenterPanel.appendChild(pnlNotes);
    presenterPanel.appendChild(pnlNext);
    presenterPanel.appendChild(pnlCounter);
    document.body.appendChild(presenterPanel);

    var openBtn = document.createElement("a");
    openBtn.textContent = "発表画面を開く";
    openBtn.href = location.pathname;
    openBtn.target = "_blank";
    openBtn.className = "open-audience-btn";
    presenterPanel.appendChild(openBtn);
  }

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

  // --- Step logic ---
  var stepIdx = 0;

  function getSteps(slideEl) {
    var area = slideEl.querySelector(".outline-text-2, .outline-text-3");
    if (!area) return [];
    return Array.from(area.querySelectorAll(
      ":scope > ul > li, :scope > ol > li, :scope > .figure, :scope > figure, :scope > table, :scope > div.org-src-container"
    ));
  }

  function initSteps(slideEl, showAll) {
    var steps = getSteps(slideEl);
    if (showAll || !steps.length) {
      steps.forEach(function(li) { li.classList.remove("step-hidden"); });
      stepIdx = steps.length;
    } else {
      steps.forEach(function(li) { li.classList.add("step-hidden"); });
      stepIdx = 0;
    }
  }

  // --- Child slide visibility ---
  function updateSlideVisibility(idx) {
    document.querySelectorAll(".outline-2 > .outline-3").forEach(function(el) {
      el.classList.remove("slide-visible");
    });
    if (slides[idx].classList.contains("outline-3")) {
      slides[idx].classList.add("slide-visible");
    }
  }

  // --- Counter (audience) ---
  var counter = document.createElement("div");
  counter.className = "slide-counter";
  document.body.appendChild(counter);
  function updateCounter() {
    if (isPresenter) return;
    var steps = getSteps(slides[currentIdx]);
    if (steps.length && stepIdx < steps.length) {
      counter.textContent = (currentIdx + 1) + " / " + slides.length +
                            "  (" + stepIdx + "/" + steps.length + ")";
    } else {
      counter.textContent = (currentIdx + 1) + " / " + slides.length;
    }
  }

  // --- Breadcrumb ---
  var breadcrumb = document.createElement("div");
  breadcrumb.className = "slide-breadcrumb";
  document.body.appendChild(breadcrumb);
  function updateBreadcrumb() {
    if (isPresenter) return;
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

  // --- TOC search ---
  function filterToc(query) {
    var q = query.toLowerCase().trim();
    var allLi = Array.from(document.querySelectorAll("#text-table-of-contents li"));
    if (!q) { allLi.forEach(function(li) { li.style.display = ""; }); return; }
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
        if (h && h.textContent.toLowerCase().includes(q)) { goTo(i, true); searchInput.blur(); break; }
      }
    }
    if (e.key === "Escape") { searchInput.value = ""; filterToc(""); searchInput.blur(); }
  });

  function syncToc() {
    currentIdx = nearestSlideIdx();
    setActive(tocLinkFor(slides[currentIdx]));
    updateSlideVisibility(currentIdx);
    updateCounter();
    updateBreadcrumb();
    if (isPresenter) updatePresenterPanel();
  }

  if (!isPresenter) {
    content.addEventListener("scrollend", syncToc);
  }

  function goTo(idx, showAll) {
    clearPendingZoom();
    if (zoomed) { zoomed = false; if (!isPresenter) closeModal(); }
    currentIdx = Math.max(0, Math.min(idx, slides.length - 1));
    clearTimeout(scrollTimer);
    if (!isPresenter) scrollTimer = setTimeout(syncToc, 1200);
    updateSlideVisibility(currentIdx);
    if (!isPresenter) {
      slides[currentIdx].scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setActive(tocLinkFor(slides[currentIdx]));
    initSteps(slides[currentIdx], showAll);
    updateCounter();
    updateBreadcrumb();
    if (isPresenter) updatePresenterPanel();
    broadcast();
  }

  // Lightbox
  var modal = document.createElement("div");
  modal.id = "code-modal";
  modal.innerHTML = "<div id=\"code-modal-inner\"></div>";
  document.body.appendChild(modal);
  var zoomed = false;
  var pendingZoom = false;
  var pendingZoomEl = null;

  function isZoomable(el) {
    return el && el.matches(".figure, figure, table, div.org-src-container");
  }
  function openModal(el) {
    var clone = el.cloneNode(true);
    clone.querySelectorAll(".step-hidden").forEach(function(c) { c.classList.remove("step-hidden"); });
    var inner = document.getElementById("code-modal-inner");
    inner.innerHTML = "";
    inner.appendChild(clone);
    modal.classList.add("active");
  }
  function closeModal() {
    modal.classList.remove("active");
  }
  function clearPendingZoom() {
    pendingZoom = false;
    pendingZoomEl = null;
  }
  modal.addEventListener("click", function() {
    zoomed = false;
    closeModal();
    broadcast();
  });

  // Initialize slide 0 state on page load
  initSteps(slides[0], false);
  updateSlideVisibility(0);
  updateCounter();
  updateBreadcrumb();
  if (isPresenter) {
    updatePresenterPanel();
  } else {
    slides[0].scrollIntoView({ behavior: "instant", block: "start" });
  }

  document.addEventListener("keydown", function(e) {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "Escape") {
      if (zoomed) {
        e.preventDefault();
        zoomed = false;
        if (!isPresenter) closeModal();
        broadcast();
      }
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (zoomed) {
        zoomed = false;
        if (!isPresenter) closeModal();
        broadcast();
        return;
      }
      if (pendingZoom) {
        zoomed = true;
        pendingZoom = false;
        if (!isPresenter) openModal(pendingZoomEl);
        broadcast();
        return;
      }
      var steps = getSteps(slides[currentIdx]);
      if (stepIdx < steps.length) {
        var step = steps[stepIdx];
        if (!isPresenter) step.classList.remove("step-hidden");
        stepIdx++;
        updateCounter();
        if (isPresenter) updatePresenterPanel();
        broadcast();
        if (isZoomable(step)) { pendingZoom = true; pendingZoomEl = step; }
      } else {
        if (currentIdx === slides.length - 1) {
          goTo(0, true);
        } else {
          goTo(currentIdx + 1, false);
        }
      }
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (zoomed) {
        zoomed = false;
        if (!isPresenter) closeModal();
        pendingZoom = true;
        broadcast();
        return;
      }
      if (pendingZoom) {
        clearPendingZoom();
        if (stepIdx > 0) {
          stepIdx--;
          if (!isPresenter) getSteps(slides[currentIdx])[stepIdx].classList.add("step-hidden");
          updateCounter();
          if (isPresenter) updatePresenterPanel();
          broadcast();
        }
        return;
      }
      if (stepIdx > 0) {
        stepIdx--;
        if (!isPresenter) getSteps(slides[currentIdx])[stepIdx].classList.add("step-hidden");
        updateCounter();
        if (isPresenter) updatePresenterPanel();
        broadcast();
      } else {
        goTo(currentIdx - 1, true);
      }
    }
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      if (zoomed) { zoomed = false; if (!isPresenter) closeModal(); }
      goTo(currentIdx + 1, true);
    }
    if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      if (zoomed) { zoomed = false; if (!isPresenter) closeModal(); }
      goTo(currentIdx - 1, true);
    }
  });
});
