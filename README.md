# FIRE Calculator

A web-based retirement calculator that helps you plan your path to financial independence. This calculator takes into account various factors including:

- Current net worth and compensation
- Tax-exempt income
- NYC-specific tax brackets
- Growth rates for compensation and spending
- Safe withdrawal rates
- Long-term capital gains tax implications

## Features

- Real-time calculations
- Detailed year-by-year projections
- Tax-aware retirement planning
- Savings and withdrawal tracking
- Automatic retirement detection based on sustainable spending

## Usage

1. Open `index.html` in a web browser
2. Enter your financial details (all monetary inputs are in thousands, e.g., $550,000 should be entered as 550)
3. The calculator will show:
   - Year-by-year projections
   - Working status
   - Income and tax calculations
   - Savings and spending
   - Retirement spending potential
   - Net worth progression

## Technical Details

- Pure HTML/JavaScript implementation
- No server required
- Uses Bootstrap for styling
- Mobile-responsive design

## Files

- `index.html` - Main calculator interface
- `calculator.js` - Core calculation logic
- `styles.css` - Custom styling

## Notes

- Calculations continue for 10 years after retirement
- All monetary inputs should be in thousands ($K)
- Tax calculations are specific to NYC residents
- Growth factors apply starting from the second year
