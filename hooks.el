;;; hooks.el --- org-slides-theme: HTML export hooks for speaker notes

(defun org-slides-export-notes (backend)
  "Convert # comment lines to <aside class=\"notes\"> in HTML export."
  (when (org-export-derived-backend-p backend 'html)
    (goto-char (point-min))
    (while (re-search-forward "^# \\(.*\\)$" nil t)
      (replace-match
       (concat "#+HTML: <aside class=\"notes\">"
               (match-string 1)
               "</aside>")
       nil t))))

(defun org-slides-normalize-aside-notes (text backend info)
  "Normalize <ASIDE CLASS=\"NOTES\"> to lowercase in final HTML output."
  (when (org-export-derived-backend-p backend 'html)
    (let* ((text (replace-regexp-in-string
                  "<ASIDE CLASS=\"NOTES\">"
                  "<aside class=\"notes\">"
                  text))
           (text (replace-regexp-in-string
                  "</ASIDE>"
                  "</aside>"
                  text)))
      text)))

(add-hook 'org-export-before-processing-hook
          'org-slides-export-notes nil t)

(add-to-list 'org-export-filter-final-output-functions
             'org-slides-normalize-aside-notes)

(provide 'org-slides-hooks)
