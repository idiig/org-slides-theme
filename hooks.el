;;; hooks.el --- org-slides-theme: HTML export hooks for speaker notes

(defun org-slides-export-notes (backend)
  "Convert # comment blocks to <aside class=\"notes\"> in HTML export.
Consecutive # lines are joined into one aside; bare # lines are deleted."
  (when (org-export-derived-backend-p backend 'html)
    (goto-char (point-min))
    (while (not (eobp))
      (cond
        ((looking-at "^# \\(.+\\)")
         (let ((group-start (point))
               lines)
           (while (looking-at "^# \\(.+\\)")
             (push (match-string 1) lines)
             (forward-line 1))
           (delete-region group-start (point))
           (insert (concat "#+HTML: <aside class=\"notes\">"
                           (mapconcat #'identity (nreverse lines) "")
                           "</aside>\n"))))
        ((looking-at "^#\\s-*$")
         (delete-region (point) (progn (forward-line 1) (point))))
        (t
         (forward-line 1))))))

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

(unless (memq 'org-slides-export-notes org-export-before-parsing-hook)
  (add-hook 'org-export-before-parsing-hook 'org-slides-export-notes))

(unless (memq 'org-slides-normalize-aside-notes org-export-filter-final-output-functions)
  (add-to-list 'org-export-filter-final-output-functions
               'org-slides-normalize-aside-notes))

(provide 'org-slides-hooks)
