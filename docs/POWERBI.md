# Power BI dashboard

The backend exposes a flat, analysis-ready dataset (resolution hours, SLA breach, rating, sentiment, agent, minutes logged…).

1. In the app: **Admin → API & webhooks → Generate** an API key.
2. Power BI Desktop → **Get data → Blank query → Advanced editor** and paste:

```m
let
    Source = Json.Document(Web.Contents("http://localhost:5000/api/v1/powerbi/tickets",
        [Headers = [#"x-api-key" = "PASTE_YOUR_KEY"]])),
    Table = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Expanded = Table.ExpandRecordColumn(Table, "Column1",
        {"code","title","status","priority","category","source","sentiment","assignee","requester","createdAt","resolvedAt","resolutionHours","slaBreached","rating","minutesLogged","reopenCount"}),
    Typed = Table.TransformColumnTypes(Expanded, {{"createdAt", type datetimezone}, {"resolvedAt", type datetimezone}, {"resolutionHours", type number}, {"rating", type number}})
in
    Typed
```

3. Suggested visuals: avg `resolutionHours` by `category`/`assignee`, tickets per week (line), `slaBreached` % by priority, `rating` by agent, sentiment mix, source mix.
4. Alternative: connect directly to MongoDB through the MongoDB Atlas SQL connector / ODBC, or use **Export CSV** on the Tickets page.

> A `.pbix` file cannot be generated automatically — build the report once in Power BI Desktop and commit the file to the repo.
