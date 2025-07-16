from django.urls import path
from . import views

urlpatterns = [
    path('my-schemas/', views.MySchemasList.as_view(), name='my_schemas'),
    path('public-schemas/', views.PublicSchemasList.as_view(), name='public_schemas'),
    path('create-schema/', views.create_schema, name='create_schema'),
    path('publish-schema/<int:schema_id>/', views.publish_schema, name='publish_schema'),
    path('use-schema/<int:schema_id>/', views.use_schema, name='use_schema'),
    path('current-schema/', views.current_schema, name='current_schema'),
    path('update-grade/<int:field_grade_id>/', views.update_grade, name='update_grade'),
    path('delete-schema/<int:schema_id>/', views.delete_schema, name='delete_schema'),
    path('save-schema/<int:schema_id>/', views.save_schema, name='save_schema'),
    path('unsave-schema/<int:schema_id>/', views.unsave_schema, name='unsave_schema'),
]