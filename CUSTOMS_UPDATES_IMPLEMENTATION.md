# Customs Updates Feature - Implementation Guide

## Overview

This implementation provides an AI-powered customs updates feature that generates and stores customs clearance information per country using OpenAI's Responses API with built-in web search.

## Components Implemented

### Backend (Django/go-api)

1. **Models** (`api/models.py`)
   - `CountryCustomsSnapshot` - Stores generated summaries per country
   - `CountryCustomsSource` - Stores source metadata and credibility scores
   - `CountryCustomsEvidenceSnippet` - Stores extracted evidence snippets

2. **Service** (`api/customs_ai_service.py`)
   - `CustomsAIService` - Orchestrates the entire generation pipeline
   - Web search and evidence extraction
   - Credibility scoring (authority, freshness, relevance, specificity)
   - Summary generation using OpenAI

3. **API Views** (`api/drf_views.py`)
   - `CustomsRegulationsView` - Lists all current snapshots
   - `CustomsRegulationCountryView` - Gets or generates snapshot for a country

4. **Serializers** (`api/serializers.py`)
   - `CountryCustomsSnapshotSerializer`
   - `CountryCustomsSourceSerializer`
   - `CountryCustomsEvidenceSnippetSerializer`

5. **Admin Interface** (`api/admin.py`)
   - Customizable admin panels for monitoring and managing snapshots

6. **Database** (`api/migrations/0240_add_customs_updates.py`)
   - Migration file for creating all necessary tables

### Frontend (React/app)

1. **CustomsUpdates Component** (`app/src/views/Spark/CustomsUpdates/`)
   - Country search input
   - Summary display with confidence levels
   - Source list with clickable URLs
   - Details modal showing evidence snippets
   - Loading states and error handling

2. **Integration** (`app/src/views/Spark/index.tsx`)
   - New "Customs Updates" tab in SPARK module

## Setup Instructions

### 1. Configure Environment Variables

Add the following to your `.env` file in `go-api/`:

```env
OPENAI_API_KEY=sk-... # Your OpenAI API key with Responses API access
```

**Note**: Make sure your OpenAI account has access to the Responses API.

### 2. Apply Database Migrations

Using Docker:

```bash
docker compose run --rm serve python manage.py migrate api
```

Or locally (if environment is set up):

```bash
python manage.py migrate api
```

### 3. Verify Configuration

Check that the settings are loaded correctly:

```bash
docker compose run --rm serve python manage.py shell
```

Then in the Python shell:

```python
from django.conf import settings
print(settings.OPENAI_API_KEY)  # Should print your API key
```

### 4. Start the Application

Backend:

```bash
docker compose up serve  # or specify in your setup
```

Frontend:

```bash
cd app
pnpm start
```

## Usage

### Frontend

1. Navigate to **SPARK** module
2. Click on **Customs Updates** tab
3. Enter a country name (must be a valid country)
4. Click **Search**
5. View the generated summary:
   - Current situation text
   - Key bullet points
   - Source list with URLs and dates
   - Confidence level badge

6. Click **View Details** to see:
   - Full source information
   - Credibility scores breakdown
   - Complete evidence snippets

### API Endpoints

#### List all current snapshots

```bash
GET /api/v2/customs-updates/

Authorization: Bearer <token>
```

Response:

```json
{
  "results": [
    {
      "id": "uuid",
      "country_name": "Kenya",
      "confidence": "High",
      "generated_at": "2026-02-10T12:00:00Z",
      "summary_text": "...",
      "current_situation_bullets": ["...", "..."],
      "sources": [...]
    }
  ]
}
```

#### Get or generate snapshot for a country

```bash
GET /api/v2/customs-updates/Kenya/

Authorization: Bearer <token>
```

Response (201 if generated, 200 if cached):

```json
{
  "id": "uuid",
  "country_name": "Kenya",
  "confidence": "High|Medium|Low",
  "generated_at": "2026-02-10T12:00:00Z",
  "summary_text": "Current situation summary...",
  "current_situation_bullets": ["Bullet 1", "Bullet 2", ...],
  "sources": [
    {
      "rank": 1,
      "url": "https://...",
      "title": "Source Title",
      "publisher": "Publisher Name",
      "published_at": "2026-02-01T00:00:00Z",
      "total_score": 95,
      "snippets": [
        {
          "snippet_order": 1,
          "snippet_text": "..."
        }
      ]
    }
  ]
}
```

## Key Features

### Snapshot Management

- **One snapshot per country**: Only one current snapshot is stored per country
- **No automatic updates**: Once generated, snapshots are returned as-is
- **Permanent storage**: All snapshots and sources are stored in PostgreSQL
- **Error handling**: Failed generation attempts are logged with error messages

### Credibility Scoring

Sources are scored on:

- **Authority** (0-50):
  - High (50): Government customs, UN agencies, IFRC, ICRC, WFP, OCHA, IOM
  - Medium (25): Large NGOs, news outlets, academic sources
  - Low (0): Blogs, forums, aggregators

- **Freshness** (0-30):
  - Updated < 30 days = 30
  - 30-90 days = 15
  - > 90 days = 5
  - No date = 0

- **Relevance** (0-25):
  - Count of relevant keywords (customs, clearance, permits, etc.)

- **Specificity** (0-30):
  - Specific documents, named agencies, entry points, delays

### Confidence Levels

- **High**: 2+ high authority sources AND 1+ source < 90 days old
- **Medium**: 1+ high authority OR 2+ medium authority AND 1+ source < 180 days old
- **Low**: Otherwise (only low authority OR old sources OR single source)

## Admin Interface

Access the Django admin at `/admin/`:

1. Navigate to **Country Customs Snapshots**
2. View all generated snapshots
3. Filter by:
   - Confidence level
   - Status (success/partial/failed)
   - Country name
   - Generation date

4. View detailed source information and evidence snippets
5. Monitor generation performance and errors

## Cost Optimization

### Per Country Generation

- **First request**: Generates snapshot (1-2 API calls to OpenAI)
- **Subsequent requests**: Returns cached snapshot (1 database query)

### Web Search Optimization

- Max 5 pages opened per run
- Only extract relevant snippets (2-8 per page)
- Score and select top 3 sources

### No Ongoing Costs

- No scheduled updates or refreshes
- Snapshots stored permanently
- Manual regeneration possible in future

## Troubleshooting

### OpenAI API Key Error

```
ImproperlyConfigured: OPENAI_API_KEY not set
```

**Solution**: Add `OPENAI_API_KEY` to your `.env` file and restart the service.

### Country Not Recognized

```json
{"detail": "'InvalidCountry' is not a recognized country."}
```

**Solution**: Use a valid ISO 3166-1 country name.

### Generation Timeout

If generation takes too long, check:
1. OpenAI API status
2. Network connectivity
3. API rate limits

Increase timeout if needed in production.

### Evidence Insufficient

```
{"status": "partial", "error_message": "No sources met credibility requirements."}
```

**Solution**: Try another country or check OpenAI search results.

## Database Indexes

The implementation creates these indexes for performance:

- `customs_country_date_idx` - Fast country lookups with date sorting
- `unique_current_country_snapshot` - Ensures single current snapshot per country
- `customs_source_snapshot_rank_idx` - Fast source retrieval
- `customs_snippet_source_order_idx` - Fast snippet retrieval

## Security Considerations

1. **Authentication Required**: All endpoints require authentication
2. **Country Validation**: Country names are validated before generation
3. **Rate Limiting**: Consider configuring rate limiting in production
4. **API Keys**: Keep OpenAI API key in environment variables, never commit to repo

## Future Extensions

Potential enhancements (out of scope for this version):

- Manual snapshot refresh/regeneration
- Scheduled updates for key countries
- Historical comparison of snapshots
- Custom search queries per country
- Evidence source credibility feedback
- Integration with other data sources
- Multi-language support

## Files Modified

```
go-api/
├── api/
│   ├── models.py (added 3 models)
│   ├── serializers.py (added 4 serializers)
│   ├── drf_views.py (updated 2 views)
│   ├── admin.py (added 3 admin panels)
│   ├── customs_ai_service.py (new)
│   └── migrations/
│       └── 0240_add_customs_updates.py (new)
├── main/
│   ├── settings.py (added OPENAI_API_KEY config)
│   └── urls.py (added 2 URL patterns)
├── .env-sample (added OPENAI_API_KEY)
└── manage.py (unchanged)

app/
└── src/views/Spark/
    ├── index.tsx (updated)
    └── CustomsUpdates/ (new)
        ├── index.tsx (new)
        └── CustomsUpdates.module.css (new)
```

## Support

For issues or questions:
1. Check the logs: `docker compose logs serve`
2. Check admin panel for snapshot status
3. Verify OpenAI API key and usage
4. Review error messages in snapshot records
