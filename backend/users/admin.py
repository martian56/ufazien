from django.contrib import admin
from django.contrib.auth import get_user_model


User = get_user_model()

class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    list_filter = ('is_staff', 'is_active')
    ordering = ('username',)

    
admin.site.register(User, UserAdmin)
