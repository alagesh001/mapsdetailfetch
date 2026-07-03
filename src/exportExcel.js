import * as XLSX from 'xlsx'

export function exportToExcel(rows, filename = 'tn-computer-institutes.xlsx') {
  const data = rows.map((r) => ({
    'Institute Name': r.name,
    'Address': r.address,
    'Phone Number': r.phone,
    'Website': r.website,
    'Rating': r.rating,
    'Review Count': r.reviewCount,
    'Google Maps URL': r.mapsUrl,
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  worksheet['!cols'] = [
    { wch: 34 }, // Institute Name
    { wch: 46 }, // Address
    { wch: 18 }, // Phone Number
    { wch: 28 }, // Website
    { wch: 8 },  // Rating
    { wch: 12 }, // Review Count
    { wch: 40 }, // Google Maps URL
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Institutes')
  XLSX.writeFile(workbook, filename)
}
