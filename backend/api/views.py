




# Create a default JSON response fro 'api/' endpoint
# THAT will include api documentation urls and a status message
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
class ApiStatus(APIView):
    """
    API status view that returns a simple JSON response with API documentation links.
    """
    def get(self, request):
        return Response({
            "message": "API is running",
            "documentation": {
                "schema": "/api/schema/",
                "swagger_ui": "/api/docs/",
                "redoc": "/api/docs/redoc/"
            }
        }, status=status.HTTP_200_OK)