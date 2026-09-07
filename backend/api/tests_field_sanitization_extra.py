from django.test import TestCase

from api.sanitize import PlainTextFieldsMixin

PAYLOAD = '<img src=x onerror=alert(1)><script>alert(2)</script>Study Group'


def inert(value):
    text = str(value).lower()
    return "<script" not in text and "onerror" not in text and "<img" not in text


class DeclarationTests(TestCase):
    """Every plain-text write serializer the assessment's field-5 covers.

    #183 sanitised community, game, blog, api and users. These four apps carry
    user-authored display text too, and were not covered: the calendar, the
    average schemas, the GPA calculations and the hosting site metadata. Only
    the blog renders stored HTML (and it has its own sanitiser), so none of
    these was a live stored-XSS vector, but the platform rule is to clean at
    the boundary rather than trust the render path, and each is now declared.
    """

    def cases(self):
        from average.serializers import (
            AverageSchemaSerializer, CreateSchemaSerializer, SchemaFieldSerializer,
        )
        from gpa.serializers import (
            CreateUserGPASerializer, GPATargetSerializer, NestedCourseGradeSerializer,
            UserGPASerializer,
        )
        from hosting.serializers import WebsiteSerializer
        from schedule.serializers import CalendarEventSerializer

        return {
            CalendarEventSerializer: {"title", "description", "location", "professor", "course_code"},
            AverageSchemaSerializer: {"name", "description"},
            CreateSchemaSerializer: {"name", "description"},
            SchemaFieldSerializer: {"name"},
            UserGPASerializer: {"name"},
            CreateUserGPASerializer: {"name"},
            NestedCourseGradeSerializer: {"course_name"},
            GPATargetSerializer: {"description"},
            WebsiteSerializer: {"name", "description"},
        }

    def test_each_declares_the_mixin_and_its_fields(self):
        for cls, expected in self.cases().items():
            self.assertTrue(issubclass(cls, PlainTextFieldsMixin), cls.__name__)
            self.assertTrue(expected.issubset(set(cls.plain_text_fields)), cls.__name__)


class BehaviourTests(TestCase):
    def test_a_calendar_event_is_cleaned_on_the_way_in(self):
        from schedule.serializers import CalendarEventSerializer

        serializer = CalendarEventSerializer(data={
            "title": PAYLOAD, "description": PAYLOAD, "location": PAYLOAD,
            "professor": PAYLOAD, "date": "2026-09-07",
            "start_time": "09:00", "end_time": "10:00",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        for field in ("title", "description", "location", "professor"):
            self.assertTrue(inert(serializer.validated_data[field]), field)
        self.assertIn("Study Group", serializer.validated_data["title"])

    def test_an_average_schema_name_is_cleaned(self):
        from average.serializers import AverageSchemaSerializer

        serializer = AverageSchemaSerializer(data={"name": PAYLOAD, "description": PAYLOAD})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertTrue(inert(serializer.validated_data["name"]))
        self.assertTrue(inert(serializer.validated_data["description"]))
        self.assertIn("Study Group", serializer.validated_data["name"])

    def test_a_create_schema_cleans_its_nested_field_names(self):
        from average.serializers import CreateSchemaSerializer

        serializer = CreateSchemaSerializer(data={
            "name": PAYLOAD, "description": "",
            "fields": [{"name": PAYLOAD, "weight": "1"}],
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertTrue(inert(serializer.validated_data["name"]))
        self.assertTrue(inert(serializer.validated_data["fields"][0]["name"]))
        self.assertIn("Study Group", serializer.validated_data["fields"][0]["name"])

    def test_a_gpa_calculation_and_its_grades_are_cleaned(self):
        from gpa.serializers import CreateUserGPASerializer

        serializer = CreateUserGPASerializer(data={
            "name": PAYLOAD, "calculation_type": "semester",
            "course_grades": [{
                "course_name": PAYLOAD, "credits": 3,
                "grade_type": "ufaz", "ufaz_grade": 15,
            }],
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertTrue(inert(serializer.validated_data["name"]))
        self.assertTrue(inert(serializer.validated_data["course_grades"][0]["course_name"]))
        self.assertIn("Study Group", serializer.validated_data["course_grades"][0]["course_name"])

    def test_a_website_name_is_cleaned(self):
        from hosting.serializers import WebsiteSerializer

        serializer = WebsiteSerializer(data={
            "name": PAYLOAD, "description": PAYLOAD, "website_type": "static",
        })
        serializer.is_valid()
        self.assertTrue(inert(serializer.validated_data.get("name", "")))
        self.assertTrue(inert(serializer.validated_data.get("description", "")))

    def test_the_color_field_is_left_alone(self):
        """A CSS token is not display text; sanitising it would be wrong."""
        from schedule.serializers import CalendarEventSerializer

        serializer = CalendarEventSerializer(data={
            "title": "Lecture", "date": "2026-09-07",
            "start_time": "09:00", "end_time": "10:00", "color": "#c0ffee",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["color"], "#c0ffee")
