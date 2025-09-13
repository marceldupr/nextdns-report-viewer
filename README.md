# NextDNS Log Explorer

A comprehensive, interactive dashboard for analyzing NextDNS logs with advanced filtering, visualization, and drill-down capabilities.

## Features

### 🔍 Advanced Filtering
- **Date & Time Range**: Filter logs by specific date ranges and time windows
- **Device Filtering**: Filter by specific devices in your network
- **Category Grouping**: Pre-configured categories for messaging apps, social media, streaming, etc.
- **Status Filtering**: Separate blocked vs allowed requests
- **Protocol & Country**: Filter by DNS protocol and destination country

### 📊 Rich Visualizations
- **Time Series Charts**: View DNS activity over time with 5-minute window grouping
- **Category Distribution**: Pie and bar charts showing request distribution by category
- **Statistical Summary**: Key metrics including block rates, top domains, and device activity
- **Interactive Charts**: Hover for details, toggle chart types

### 📋 Detailed Analysis
- **Sortable Data Table**: Sort by any column, search across all fields
- **Pagination**: Handle large datasets efficiently
- **Export-Ready**: All data visible and searchable
- **Real-time Filtering**: All visualizations update instantly with filter changes

### 🏷️ Smart Categorization
Automatically categorizes domains into meaningful groups:
- WhatsApp Domain Access
- Facebook Domain Access
- Other Messaging (Telegram, Discord, Signal, etc.)
- Social Media
- Streaming & Entertainment
- Google Services
- Cloud & CDN
- Advertising & Analytics
- Security & Monitoring
- Other

## Installation

1. **Clone or download** this project to your local machine

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Usage

### 1. Export NextDNS Logs
1. Go to your NextDNS dashboard
2. Navigate to the "Logs" section
3. Export your logs as CSV format
4. Download the CSV file to your computer

### 2. Upload and Analyze
1. Open the NextDNS Log Explorer in your browser
2. Drag and drop your CSV file or click to browse
3. Wait for the file to process (may take a moment for large files)
4. Start exploring your data!

### 3. Using Filters
- **Date Range**: Select start and end dates to focus on specific time periods
- **Time Range**: Filter by specific hours of the day
- **Categories**: Select one or more categories to focus on (e.g., "WhatsApp Domain Access")
- **Devices**: Filter by specific devices in your network
- **Status**: Show only blocked or allowed requests
- **Clear All**: Reset all filters to see the complete dataset

### 4. Exploring Views
- **Overview**: Summary statistics and key charts
- **Charts**: Detailed visualizations with chart type options
- **Data Table**: Sortable, searchable table of individual log entries

## Technical Details

### Built With
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Modern, responsive styling
- **Recharts**: Interactive chart library
- **Papa Parse**: Fast CSV parsing
- **date-fns**: Date manipulation utilities
- **Lucide React**: Beautiful icons

### File Structure
```
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main dashboard page
├── components/
│   ├── CategoryChart.tsx    # Category distribution charts
│   ├── DataTable.tsx        # Sortable data table
│   ├── FileSelector.tsx     # CSV file upload component
│   ├── FilterPanel.tsx      # Advanced filtering panel
│   ├── StatsSummary.tsx     # Statistical summary cards
│   └── TimeSeriesChart.tsx  # Time-based charts
├── types/
│   └── dns-log.ts           # TypeScript type definitions
├── utils/
│   └── csv-parser.ts        # CSV parsing and data processing
└── data/
    └── [your-csv-files]     # Place your CSV files here
```

### Performance Optimizations
- **Efficient CSV Parsing**: Streams large files without blocking the UI
- **Memoized Calculations**: Expensive operations are cached and only recalculated when needed
- **Pagination**: Large datasets are paginated for smooth performance
- **Smart Filtering**: All filters work together efficiently

### Data Processing
The application processes your NextDNS CSV data by:
1. **Parsing**: Converting CSV rows into structured data objects
2. **Categorization**: Automatically assigning domains to meaningful categories
3. **Time Windowing**: Grouping requests into 5-minute windows for analysis
4. **Statistical Calculation**: Computing summary statistics and aggregations

## Browser Compatibility

Works in all modern browsers including:
- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Privacy & Security

- **Local Processing**: All data processing happens in your browser
- **No Data Upload**: Your DNS logs never leave your computer
- **No Tracking**: No analytics or tracking scripts included

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the dashboard.

## License

This project is open source and available under the MIT License.
