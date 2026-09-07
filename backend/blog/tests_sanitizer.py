from django.test import TestCase

from blog.security import SecurityUtils


class DangerousContentTests(TestCase):
    """Payloads the previous sanitizer let through.

    It escaped everything and then restored the allowed tags by regex,
    attributes and all, so only the four event handlers named in a blocklist
    were ever removed.
    """

    def clean(self, value):
        return SecurityUtils.sanitize_html_content(value).lower()

    def test_a_script_tag_does_not_survive(self):
        self.assertNotIn("<script", self.clean("<script>alert(1)</script>"))

    def test_the_blocked_handlers_are_gone(self):
        for handler in ["onerror", "onload", "onclick", "onmouseover"]:
            payload = f'<img src=x {handler}=alert(1)>'
            self.assertNotIn(handler, self.clean(payload), handler)

    def test_the_handlers_the_blocklist_never_named_are_gone_too(self):
        for handler in [
            "onfocus", "ontoggle", "onanimationstart", "onpointerdown",
            "onwheel", "oncopy", "onbeforeinput", "onscrollend",
        ]:
            payload = f'<div {handler}=alert(1) autofocus>x</div>'
            self.assertNotIn(handler, self.clean(payload), handler)

    def test_a_javascript_url_is_dropped_whatever_its_case(self):
        for url in ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "  javascript:alert(1)"]:
            self.assertNotIn("javascript", self.clean(f'<a href="{url}">x</a>'), url)

    def test_a_data_url_is_dropped(self):
        self.assertNotIn("data:", self.clean('<img src="data:text/html,<script>alert(1)</script>">'))

    def test_framing_elements_are_dropped(self):
        for tag in ["iframe", "object", "embed", "form", "svg", "math", "base"]:
            self.assertNotIn(f"<{tag}", self.clean(f"<{tag} src=//evil>x</{tag}>"), tag)

    def test_css_cannot_carry_a_script(self):
        cleaned = self.clean('<p style="background:url(javascript:alert(1))">x</p>')
        self.assertNotIn("javascript", cleaned)

    def test_css_expression_is_dropped(self):
        self.assertNotIn("expression", self.clean('<p style="width:expression(alert(1))">x</p>'))

    def test_a_comment_cannot_smuggle_markup(self):
        self.assertNotIn("<script", self.clean("<!--<script>alert(1)</script>-->"))

    def test_nothing_at_all_is_handled(self):
        self.assertEqual(SecurityUtils.sanitize_html_content(""), "")
        self.assertEqual(SecurityUtils.sanitize_html_content(None), "")


class LegitimateContentTests(TestCase):
    """What the 51 posts in production actually use has to survive."""

    def clean(self, value):
        return SecurityUtils.sanitize_html_content(value)

    def test_the_tags_real_posts_use_are_kept(self):
        source = (
            "<h1>a</h1><h2>b</h2><h3>c</h3><p>d</p><strong>e</strong><em>f</em>"
            "<b>g</b><i>h</i><ul><li>i</li></ul><ol><li>j</li></ol>"
            "<pre><code>k</code></pre><blockquote>l</blockquote><hr><br><div>m</div>"
        )
        cleaned = self.clean(source)
        for tag in ["h1", "h2", "h3", "p", "strong", "em", "b", "i", "ul", "li",
                    "ol", "pre", "code", "blockquote", "hr", "br", "div"]:
            self.assertIn(f"<{tag}", cleaned, tag)

    def test_a_link_keeps_its_destination(self):
        self.assertIn('href="https://example.com"', self.clean('<a href="https://example.com">x</a>'))

    def test_a_mailto_link_is_kept(self):
        self.assertIn("mailto:", self.clean('<a href="mailto:a@b.com">x</a>'))

    def test_an_image_keeps_its_source_and_alt(self):
        cleaned = self.clean('<img src="https://x/y.png" alt="pic">')
        self.assertIn('src="https://x/y.png"', cleaned)
        self.assertIn('alt="pic"', cleaned)

    def test_a_code_block_keeps_its_language_class(self):
        self.assertIn('class="lang-py"', self.clean('<pre><code class="lang-py">x</code></pre>'))

    def test_an_ordered_list_keeps_its_start(self):
        self.assertIn('start="3"', self.clean('<ol start="3"><li>x</li></ol>'))

    def test_safe_styling_is_kept(self):
        cleaned = self.clean('<p style="color:#c00;text-align:center">x</p>')
        self.assertIn("color", cleaned)
        self.assertIn("text-align", cleaned)

    def test_writing_about_xss_is_not_rejected(self):
        """The old pattern list refused any post that merely mentioned these."""
        source = "<p>Never write <code>document.cookie</code> or use <code>eval()</code>.</p>"
        cleaned = self.clean(source)
        self.assertIn("document.cookie", cleaned)
        self.assertIn("eval()", cleaned)


class LinkTargetTests(TestCase):
    def clean(self, value):
        return SecurityUtils.sanitize_html_content(value)

    def test_a_new_tab_link_gets_noopener(self):
        cleaned = self.clean('<a href="https://e.com" target="_blank">x</a>')
        self.assertIn("noopener", cleaned)
        self.assertIn("noreferrer", cleaned)

    def test_an_ordinary_link_is_left_alone(self):
        self.assertNotIn("noopener", self.clean('<a href="https://e.com">x</a>'))

    def test_an_existing_rel_is_not_duplicated(self):
        cleaned = self.clean('<a href="https://e.com" target="_blank" rel="noopener">x</a>')
        self.assertEqual(cleaned.count("noopener"), 1)
