// Constants for tax calculations (2024 NYC)
const TAX_BRACKETS = {
    federal: [
        { threshold: 11600, rate: 0.10 },
        { threshold: 47150, rate: 0.12 },
        { threshold: 100525, rate: 0.22 },
        { threshold: 191950, rate: 0.24 },
        { threshold: 243725, rate: 0.32 },
        { threshold: 609350, rate: 0.35 },
        { threshold: Infinity, rate: 0.37 }
    ],
    nyState: [
        { threshold: 8500, rate: 0.04 },
        { threshold: 11700, rate: 0.045 },
        { threshold: 13900, rate: 0.0525 },
        { threshold: 80650, rate: 0.0585 },
        { threshold: 215400, rate: 0.0597 },
        { threshold: 1077550, rate: 0.0633 },
        { threshold: 5000000, rate: 0.0685 },
        { threshold: Infinity, rate: 0.103 }
    ],
    nycLocal: [
        { threshold: 12000, rate: 0.03078 },
        { threshold: 25000, rate: 0.03762 },
        { threshold: 50000, rate: 0.03819 },
        { threshold: Infinity, rate: 0.03876 }
    ],
    capitalGains: [
        { threshold: 44625, rate: 0.0 },    // 2024 0% bracket
        { threshold: 492300, rate: 0.15 },   // 2024 15% bracket
        { threshold: Infinity, rate: 0.20 }  // 2024 20% bracket
    ]
};

const RETIREMENT_LIMITS = {
    "401k": 23000, // 2024 limit
    hsa: 4150,   // 2024 limit for individual
    fica: {
        socialSecurity: {
            limit: 168600,
            rate: 0.062
        },
        medicare: {
            rate: 0.0145,
            additionalRate: 0.009, // Additional Medicare tax over $200,000
            threshold: 200000
        }
    }
};

// Calculate taxes based on income and type
function calculateTaxes(income, isCapitalGains = false) {
    const calculateBracketTax = (income, brackets) => {
        let tax = 0;
        let previousThreshold = 0;

        for (const bracket of brackets) {
            const taxableInThisBracket = Math.min(income - previousThreshold, bracket.threshold - previousThreshold);
            if (taxableInThisBracket > 0) {
                tax += taxableInThisBracket * bracket.rate;
            }
            previousThreshold = bracket.threshold;
            if (income <= bracket.threshold) break;
        }
        return tax;
    };

    if (isCapitalGains) {
        // For retirement, we only apply capital gains tax
        const federalCapGainsTax = calculateBracketTax(income, TAX_BRACKETS.capitalGains);
        return {
            federal: federalCapGainsTax,
            state: 0, // NY doesn't tax social security benefits
            local: 0,
            fica: 0,
            total: federalCapGainsTax,
            effectiveRate: (federalCapGainsTax / income) * 100
        };
    }

    // Calculate FICA taxes
    let ficaTax = 0;
    // Social Security
    ficaTax += Math.min(income, RETIREMENT_LIMITS.fica.socialSecurity.limit) * RETIREMENT_LIMITS.fica.socialSecurity.rate;
    // Medicare
    ficaTax += income * RETIREMENT_LIMITS.fica.medicare.rate;
    if (income > RETIREMENT_LIMITS.fica.medicare.threshold) {
        ficaTax += (income - RETIREMENT_LIMITS.fica.medicare.threshold) * RETIREMENT_LIMITS.fica.medicare.additionalRate;
    }

    // Calculate income taxes
    const federalTax = calculateBracketTax(income, TAX_BRACKETS.federal);
    const stateTax = calculateBracketTax(income, TAX_BRACKETS.nyState);
    const localTax = calculateBracketTax(income, TAX_BRACKETS.nycLocal);
    const totalTax = federalTax + stateTax + localTax + ficaTax;

    return {
        federal: federalTax,
        state: stateTax,
        local: localTax,
        fica: ficaTax,
        total: totalTax,
        effectiveRate: (totalTax / income) * 100
    };
}

// Calculate retirement projections
function calculateRetirement(formData) {
    const results = [];
    let currentYear = new Date().getFullYear();
    let currentAge = formData.currentAge;
    // Convert inputs from thousands to actual dollars
    let networth = formData.currentNetworth * 1000;
    let compensation = formData.currentCompensation * 1000;
    let annualSpend = formData.currentSpend * 1000;
    let taxExemptIncome = formData.taxExemptIncome * 1000;
    let requiredRetirementSpend = formData.requiredRetirementSpend * 1000;
    let isRetired = false;
    let isFirstYear = true;
    let canRetireNextYear = false;
    let yearsInRetirement = 0;

    for (let year = 0; year < 40; year++) {
        let annualIncome, taxes, afterTaxIncome, annualSavings, savingsWithdrawal = 0;

        // Calculate potential retirement spend and required withdrawal
        const calculateGrossWithdrawal = (targetSpend) => {
            // For capital gains tax brackets, calculate how much we need to withdraw
            // to have targetSpend left after taxes
            let low = targetSpend;  // Minimum possible (if no taxes)
            let high = targetSpend * 2;  // Maximum reasonable guess
            const PRECISION = 0.01;  // Get within 1 cent
            
            while (high - low > PRECISION) {
                const mid = (low + high) / 2;
                const taxes = calculateTaxes(mid, true);
                const afterTax = mid - taxes.total;
                
                if (afterTax > targetSpend) {
                    high = mid;
                } else {
                    low = mid;
                }
            }
            return (low + high) / 2;
        };

        // Calculate what we could withdraw based on our current networth
        const potentialGrossWithdrawal = networth * (formData.withdrawalRate / 100);
        // Calculate how much we could actually spend after taxes
        const potentialAfterTaxSpend = potentialGrossWithdrawal - calculateTaxes(potentialGrossWithdrawal, true).total;

        // Update annual spend (caps at required retirement spend)
        if (!isRetired && !isFirstYear) {
            annualSpend = Math.min(
                annualSpend * (1 + formData.spendGrowth / 100),
                requiredRetirementSpend
            );
        }

        // Check if we can retire next year
        if (!isRetired && !canRetireNextYear) {
            // Calculate how much we need to withdraw to get required spend
            const requiredGrossWithdrawal = calculateGrossWithdrawal(requiredRetirementSpend);
            if (potentialGrossWithdrawal >= requiredGrossWithdrawal) {
                canRetireNextYear = true;
            }
        }

        // If we could retire last year, retire now
        if (!isRetired && canRetireNextYear && !isFirstYear) {
            isRetired = true;
            // Set annual spend to required retirement spend
            annualSpend = requiredRetirementSpend;
        }

        if (!isRetired) {
            // Working income calculation
            annualIncome = isFirstYear ? compensation + taxExemptIncome : 
                          compensation * (1 + formData.compensationGrowth / 100) + taxExemptIncome;
            taxes = calculateTaxes(annualIncome - taxExemptIncome); // Only tax non-exempt income
            afterTaxIncome = (annualIncome - taxExemptIncome) - taxes.total + taxExemptIncome;
            
            // Calculate savings
            annualSavings = afterTaxIncome - annualSpend;

            // Update values for next year if still working
            if (!isFirstYear) {
                networth = networth * (1 + formData.stockReturns / 100) + annualSavings;
                compensation = compensation * (1 + formData.compensationGrowth / 100);
            } else {
                networth = networth + annualSavings;
            }
        } else {
            yearsInRetirement++;
            // In retirement, we withdraw exactly what we need for required spend
            savingsWithdrawal = calculateGrossWithdrawal(requiredRetirementSpend);
            
            // Retirement income calculation
            annualIncome = savingsWithdrawal;
            taxes = calculateTaxes(annualIncome, true);
            afterTaxIncome = annualIncome - taxes.total;
            annualSpend = requiredRetirementSpend; // Fixed at required retirement spend
            annualSavings = afterTaxIncome - annualSpend;

            // Update networth in retirement
            if (!isFirstYear) {
                networth = networth * (1 + formData.stockReturns / 100) + annualSavings;
            } else {
                networth = networth + annualSavings;
            }
        }

        results.push({
            year: currentYear + year,
            age: currentAge + year,
            workingStatus: isRetired ? 'Retired' : 'Working',
            annualIncome: Math.round(annualIncome),
            taxRate: taxes.effectiveRate.toFixed(1),
            afterTaxIncome: Math.round(afterTaxIncome),
            annualSpend: Math.round(annualSpend),
            annualSavings: Math.round(annualSavings),
            networth: Math.round(networth),
            savingsWithdrawal: Math.round(savingsWithdrawal),
            potentialRetirementSpend: Math.round(potentialAfterTaxSpend)
        });

        if (networth < 0 || (isRetired && yearsInRetirement > 10)) break; // Stop if we run out of money or 10 years after retirement
        isFirstYear = false;
    }

    return results;
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(amount);
}

// Handle form submission
document.getElementById('retirementForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = {
        currentAge: parseInt(document.getElementById('currentAge').value),
        currentNetworth: parseFloat(document.getElementById('currentNetworth').value),
        currentCompensation: parseFloat(document.getElementById('currentCompensation').value),
        taxExemptIncome: parseFloat(document.getElementById('taxExemptIncome').value),
        compensationGrowth: parseFloat(document.getElementById('compensationGrowth').value),
        currentSpend: parseFloat(document.getElementById('currentSpend').value),
        requiredRetirementSpend: parseFloat(document.getElementById('requiredRetirementSpend').value),
        spendGrowth: parseFloat(document.getElementById('spendGrowth').value),
        withdrawalRate: parseFloat(document.getElementById('withdrawalRate').value),
        stockReturns: parseFloat(document.getElementById('stockReturns').value)
    };

    const results = calculateRetirement(formData);
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';

    results.forEach(result => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${result.year}</td>
            <td>${result.age}</td>
            <td>${result.workingStatus}</td>
            <td class="money-value">${formatCurrency(result.annualIncome)}</td>
            <td>${result.taxRate}%</td>
            <td class="money-value">${formatCurrency(result.afterTaxIncome)}</td>
            <td class="money-value">${formatCurrency(result.annualSpend)}</td>
            <td class="money-value">${formatCurrency(result.annualSavings)}</td>
            <td class="money-value">${formatCurrency(result.networth)}</td>
            <td class="money-value">${formatCurrency(result.savingsWithdrawal)}</td>
            <td class="money-value">${formatCurrency(result.potentialRetirementSpend)}</td>
        `;
        tbody.appendChild(row);
    });
}); 