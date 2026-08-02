param(
    [ValidateRange(1, 9)]
    [int]$RegionNumber = 1,
    [ValidateRange(2021, 2025)]
    [int]$Year = 2025,
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $projectRoot "docs\exports\desempenho-populacional-rf$RegionNumber-$Year.png"
}

$dataPath = Join-Path $projectRoot "public\data\v2025\rankings\$Year\rf$RegionNumber.json"
$regionData = (
    [System.IO.File]::ReadAllText($dataPath, [System.Text.Encoding]::UTF8) |
        ConvertFrom-Json
).data
$municipalities = @(
    $regionData.municipalities |
        Sort-Object -Property municipalityName
)
if ($municipalities.Count -eq 0) {
    throw "No municipalities found for RF$RegionNumber in $Year."
}

$palette = @{
    Ink = "#142A41"
    Muted = "#52657A"
    Grid = "#D8E2E9"
    AboveFill = "#72C4A5"
    AboveStroke = "#087654"
    ExpectedFill = "#E6B84B"
    ExpectedStroke = "#8A5A12"
    BelowFill = "#E9898E"
    BelowStroke = "#B4232D"
    White = "#FFFFFF"
}

$counts = @{
    above = @($municipalities | Where-Object { $_.populationPerformance.code -eq "above" }).Count
    expected = @($municipalities | Where-Object { $_.populationPerformance.code -eq "expected" }).Count
    below = @($municipalities | Where-Object { $_.populationPerformance.code -eq "below" }).Count
}

$plotLeft = 420.0
$maximumMunicipalitiesPerPanel = 80
$panelCount = [int][Math]::Ceiling(
    $municipalities.Count / [double]$maximumMunicipalitiesPerPanel
)
$municipalitiesPerPanel = [int][Math]::Ceiling(
    $municipalities.Count / [double]$panelCount
)
$panelLayouts = @()

if ($panelCount -eq 1) {
    $slotWidth = 78.0
    $barWidth = 52.0
    $municipalityFontSize = 66.0
    $canvasHeight = 1900
    $panelLayouts += [pscustomobject]@{
        StartIndex = 0
        Count = $municipalities.Count
        PositiveTop = 470.0
        ZeroY = 660.0
        NegativeBottom = 850.0
        LabelTop = 920.0
    }
}
else {
    $slotWidth = 84.0
    $barWidth = 56.0
    $municipalityFontSize = 60.0
    $canvasHeight = 3400
    for ($panelIndex = 0; $panelIndex -lt $panelCount; $panelIndex++) {
        $startIndex = $panelIndex * $municipalitiesPerPanel
        $itemsInPanel = [Math]::Min(
            $municipalitiesPerPanel,
            $municipalities.Count - $startIndex
        )
        $verticalOffset = $panelIndex * 1500.0
        $panelLayouts += [pscustomobject]@{
            StartIndex = $startIndex
            Count = $itemsInPanel
            PositiveTop = 430.0 + $verticalOffset
            ZeroY = 620.0 + $verticalOffset
            NegativeBottom = 810.0 + $verticalOffset
            LabelTop = 880.0 + $verticalOffset
        }
    }
}

$maximumPanelItems = [int]((
    $panelLayouts |
        Measure-Object -Property Count -Maximum
).Maximum)
$plotRight = $plotLeft + $maximumPanelItems * $slotWidth
$naturalCanvasWidth = [int]($plotRight + 120)
$canvasWidth = [int][Math]::Max(3000, $naturalCanvasWidth)
if ($canvasWidth -gt $naturalCanvasWidth) {
    $plotLeft += ($canvasWidth - $naturalCanvasWidth) / 2.0
    $plotRight = $plotLeft + $maximumPanelItems * $slotWidth
}

function Get-Color([string]$hex) {
    return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function New-Brush([string]$hex) {
    return [System.Drawing.SolidBrush]::new((Get-Color $hex))
}

function New-Pen([string]$hex, [double]$width) {
    return [System.Drawing.Pen]::new((Get-Color $hex), [single]$width)
}

function Draw-Text {
    param(
        [string]$Value,
        [double]$X,
        [double]$Y,
        [double]$Width,
        [double]$Height,
        [System.Drawing.Font]$Font,
        [System.Drawing.Brush]$Brush,
        [ValidateSet("Left", "Center", "Right")]
        [string]$Alignment = "Left"
    )

    $format = [System.Drawing.StringFormat]::new()
    try {
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $format.Alignment = switch ($Alignment) {
            "Center" { [System.Drawing.StringAlignment]::Center }
            "Right" { [System.Drawing.StringAlignment]::Far }
            default { [System.Drawing.StringAlignment]::Near }
        }
        $format.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
        $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
        $rectangle = [System.Drawing.RectangleF]::new(
            [single]$X,
            [single]$Y,
            [single]$Width,
            [single]$Height
        )
        $script:graphics.DrawString($Value, $Font, $Brush, $rectangle, $format)
    }
    finally {
        $format.Dispose()
    }
}

function Draw-RotatedMunicipality {
    param(
        [string]$Value,
        [double]$CenterX,
        [double]$TopY,
        [System.Drawing.Font]$Font,
        [System.Drawing.Brush]$Brush
    )

    $measured = $script:graphics.MeasureString($Value, $Font)
    $bottomY = $TopY + $measured.Width
    $state = $script:graphics.Save()
    try {
        $script:graphics.TranslateTransform(
            [single]($CenterX - 35),
            [single]$bottomY
        )
        $script:graphics.RotateTransform(-90)
        $script:graphics.DrawString(
            $Value,
            $Font,
            $Brush,
            [single]0,
            [single]0
        )
    }
    finally {
        $script:graphics.Restore($state)
    }
}

function Draw-LegendItem {
    param(
        [double]$X,
        [string]$Label,
        [string]$FillColor,
        [string]$StrokeColor
    )

    $fill = New-Brush $FillColor
    $stroke = New-Pen $StrokeColor 4
    try {
        $script:graphics.FillRectangle($fill, [single]$X, 120, 58, 58)
        $script:graphics.DrawRectangle($stroke, [single]$X, 120, 58, 58)
        Draw-Text $Label ($X + 82) 100 570 100 $fonts.Legend $brushes.Ink
    }
    finally {
        $fill.Dispose()
        $stroke.Dispose()
    }
}

$bitmap = [System.Drawing.Bitmap]::new(
    $canvasWidth,
    $canvasHeight,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
)
$bitmap.SetResolution(300, 300)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$script:graphics = $graphics

$fonts = @{}
$brushes = @{}
$pens = @{}

try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear((Get-Color $palette.White))

    $fonts.Region = [System.Drawing.Font]::new(
        "Segoe UI",
        70,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Legend = [System.Drawing.Font]::new(
        "Segoe UI",
        58,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Axis = [System.Drawing.Font]::new(
        "Segoe UI",
        62,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Municipality = [System.Drawing.Font]::new(
        "Segoe UI",
        $municipalityFontSize,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Value = [System.Drawing.Font]::new(
        "Segoe UI",
        44,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )

    $brushes.Ink = New-Brush $palette.Ink
    $brushes.Muted = New-Brush $palette.Muted
    $brushes.White = New-Brush $palette.White
    $brushes.Above = New-Brush $palette.AboveFill
    $brushes.Expected = New-Brush $palette.ExpectedFill
    $brushes.Below = New-Brush $palette.BelowFill
    $brushes.AboveText = New-Brush $palette.AboveStroke
    $brushes.ExpectedText = New-Brush $palette.ExpectedStroke
    $brushes.BelowText = New-Brush $palette.BelowStroke

    $pens.Grid = New-Pen $palette.Grid 3
    $pens.Grid.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $pens.Zero = New-Pen $palette.Ink 6
    $pens.Above = New-Pen $palette.AboveStroke 4
    $pens.Expected = New-Pen $palette.ExpectedStroke 4
    $pens.Below = New-Pen $palette.BelowStroke 4

    Draw-Text "RF$RegionNumber  $Year" 70 85 500 110 $fonts.Region $brushes.Ink

    $legendStart = [Math]::Max(700, ($canvasWidth - 2060) / 2)
    Draw-LegendItem $legendStart "ACIMA" $palette.AboveFill $palette.AboveStroke
    Draw-LegendItem ($legendStart + 690) "NO INTERVALO" $palette.ExpectedFill $palette.ExpectedStroke
    Draw-LegendItem ($legendStart + 1510) "ABAIXO" $palette.BelowFill $palette.BelowStroke

    foreach ($panel in $panelLayouts) {
        $panelPlotRight = $plotLeft + [int]$panel.Count * $slotWidth
        $graphics.DrawLine(
            $pens.Grid,
            [single]$plotLeft,
            [single]$panel.PositiveTop,
            [single]$panelPlotRight,
            [single]$panel.PositiveTop
        )
        $graphics.DrawLine(
            $pens.Zero,
            [single]$plotLeft,
            [single]$panel.ZeroY,
            [single]$panelPlotRight,
            [single]$panel.ZeroY
        )
        $graphics.DrawLine(
            $pens.Grid,
            [single]$plotLeft,
            [single]$panel.NegativeBottom,
            [single]$panelPlotRight,
            [single]$panel.NegativeBottom
        )

        for ($panelOffset = 0; $panelOffset -lt $panel.Count; $panelOffset++) {
            $index = [int]$panel.StartIndex + $panelOffset
            $municipality = $municipalities[$index]
            $centerX = $plotLeft + ($panelOffset + 0.5) * $slotWidth
            $barLeft = $centerX - $barWidth / 2
            $performanceCode = [string]$municipality.populationPerformance.code

            switch ($performanceCode) {
                "above" {
                    $graphics.FillRectangle(
                        $brushes.Above,
                        [single]$barLeft,
                        [single]$panel.PositiveTop,
                        [single]$barWidth,
                        [single]($panel.ZeroY - $panel.PositiveTop)
                    )
                    $graphics.DrawRectangle(
                        $pens.Above,
                        [single]$barLeft,
                        [single]$panel.PositiveTop,
                        [single]$barWidth,
                        [single]($panel.ZeroY - $panel.PositiveTop)
                    )
                }
                "below" {
                    $graphics.FillRectangle(
                        $brushes.Below,
                        [single]$barLeft,
                        [single]$panel.ZeroY,
                        [single]$barWidth,
                        [single]($panel.NegativeBottom - $panel.ZeroY)
                    )
                    $graphics.DrawRectangle(
                        $pens.Below,
                        [single]$barLeft,
                        [single]$panel.ZeroY,
                        [single]$barWidth,
                        [single]($panel.NegativeBottom - $panel.ZeroY)
                    )
                }
                "expected" {
                    $markerSize = 46.0
                    $graphics.FillEllipse(
                        $brushes.Expected,
                        [single]($centerX - $markerSize / 2),
                        [single]($panel.ZeroY - $markerSize / 2),
                        [single]$markerSize,
                        [single]$markerSize
                    )
                    $graphics.DrawEllipse(
                        $pens.Expected,
                        [single]($centerX - $markerSize / 2),
                        [single]($panel.ZeroY - $markerSize / 2),
                        [single]$markerSize,
                        [single]$markerSize
                    )
                }
                default {
                    throw "Unsupported population performance code: $performanceCode"
                }
            }

            Draw-RotatedMunicipality (
                [string]$municipality.municipalityName
            ) $centerX $panel.LabelTop $fonts.Municipality $brushes.Ink
        }
    }

    $outputDirectory = Split-Path -Parent $OutputPath
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory | Out-Null
    }
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
    foreach ($font in $fonts.Values) {
        if ($null -ne $font) { $font.Dispose() }
    }
    foreach ($pen in $pens.Values) {
        if ($null -ne $pen) { $pen.Dispose() }
    }
    foreach ($brush in $brushes.Values) {
        if ($null -ne $brush) { $brush.Dispose() }
    }
    $graphics.Dispose()
    $bitmap.Dispose()
}

$image = [System.Drawing.Image]::FromFile($OutputPath)
try {
    [pscustomobject]@{
        Path = $OutputPath
        Width = $image.Width
        Height = $image.Height
        DpiX = [Math]::Round($image.HorizontalResolution, 2)
        Bytes = (Get-Item -LiteralPath $OutputPath).Length
        Municipalities = $municipalities.Count
        Panels = $panelCount
        Above = $counts.above
        Expected = $counts.expected
        Below = $counts.below
    } | Format-List
}
finally {
    $image.Dispose()
}
