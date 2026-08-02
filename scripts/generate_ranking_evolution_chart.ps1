param(
    [ValidateRange(1, 9)]
    [int]$RegionNumber = 1,
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $projectRoot "docs\exports\evolucao-ranking-geral-rf$RegionNumber-2021-2025.png"
}

$years = @(2021, 2022, 2023, 2024, 2025)
$rankings = @{}
foreach ($year in $years) {
    $path = Join-Path $projectRoot "public\data\v2025\rankings\$year\rf$RegionNumber.json"
    $rankings[$year] = (
        [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8) |
            ConvertFrom-Json
    ).data
}

$topMunicipalities = @($rankings[2025].municipalities | Select-Object -First 5)
$series = @()
foreach ($municipality in $topMunicipalities) {
    $positions = @()
    foreach ($year in $years) {
        $historicalMunicipality = $rankings[$year].municipalities |
            Where-Object municipalityId -eq $municipality.municipalityId |
            Select-Object -First 1
        if ($null -eq $historicalMunicipality) {
            throw "Município $($municipality.municipalityName) ausente em $year."
        }
        $positions += [int]$historicalMunicipality.overallRank
    }
    $series += [pscustomobject]@{
        Name = $municipality.municipalityName
        Positions = $positions
    }
}

$palette = @(
    "#0B7A75",
    "#2E6AB3",
    "#B57A00",
    "#7B5AA6",
    "#C65D3A"
)

$unicode = @{
    IAcuteUpper = [char]0x00CD
    EAcute = [char]0x00E9
    IAcute = [char]0x00ED
    CCedilla = [char]0x00E7
    CCedillaUpper = [char]0x00C7
    ATilde = [char]0x00E3
    ATildeUpper = [char]0x00C3
    OTilde = [char]0x00F5
    Degree = [char]0x00BA
    MiddleDot = [char]0x00B7
    EnDash = [char]0x2013
}

$titleText = "Evolu$($unicode.CCedilla)$($unicode.ATilde)o da posi$($unicode.CCedilla)$($unicode.ATilde)o no ranking geral"
$subtitleText = "Regi$($unicode.ATilde)o Funcional $RegionNumber $($unicode.MiddleDot) cinco primeiros munic$($unicode.IAcute)pios em 2025 $($unicode.MiddleDot) 2021$($unicode.EnDash)2025"
$badgeTextValue = "1$($unicode.Degree) = melhor posi$($unicode.CCedilla)$($unicode.ATilde)o"
$positionHeading = "POSI$($unicode.CCedillaUpper)$($unicode.ATildeUpper)O"
$municipalityHeading = "MUNIC$($unicode.IAcuteUpper)PIO - RF$RegionNumber"
$criterionText = "Crit$($unicode.EAcute)rio: munic$($unicode.IAcute)pios selecionados pelas cinco primeiras posi$($unicode.CCedilla)$($unicode.OTilde)es da RF$RegionNumber em 2025."
$sourceText = "Fonte: Radar dos Munic$($unicode.IAcute)pios $($unicode.MiddleDot) rankings anuais 2021$($unicode.EnDash)2025."

$canvasWidth = 3600
$plotLeft = 420.0
$plotRight = 2600.0
$plotTop = 230.0
$labelX = 2750.0
$laneSpacing = 100.0
$displayRanks = @(
    $series |
        ForEach-Object { @($_.Positions) } |
        ForEach-Object { [int]$_ } |
        Sort-Object -Unique
)
$rankLaneIndex = @{}
for ($laneIndex = 0; $laneIndex -lt $displayRanks.Count; $laneIndex++) {
    $rankLaneIndex[[int]$displayRanks[$laneIndex]] = $laneIndex
}
$plotBottom = $plotTop + [Math]::Max(1, $displayRanks.Count - 1) * $laneSpacing
$yearLabelY = $plotBottom + 65
$canvasHeight = [int]($plotBottom + 190)
$maximumRank = [int](($series | ForEach-Object { $_.Positions } | Measure-Object -Maximum).Maximum)
$maximumRank = [Math]::Max(5, $maximumRank)

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

function Draw-RoundedRectangle {
    param(
        [double]$X,
        [double]$Y,
        [double]$Width,
        [double]$Height,
        [double]$Radius,
        [System.Drawing.Brush]$Fill,
        [System.Drawing.Pen]$Stroke
    )

    $diameter = [single]($Radius * 2)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    try {
        $path.AddArc([single]$X, [single]$Y, $diameter, $diameter, 180, 90)
        $path.AddArc(
            [single]($X + $Width - $diameter),
            [single]$Y,
            $diameter,
            $diameter,
            270,
            90
        )
        $path.AddArc(
            [single]($X + $Width - $diameter),
            [single]($Y + $Height - $diameter),
            $diameter,
            $diameter,
            0,
            90
        )
        $path.AddArc(
            [single]$X,
            [single]($Y + $Height - $diameter),
            $diameter,
            $diameter,
            90,
            90
        )
        $path.CloseFigure()
        $script:graphics.FillPath($Fill, $path)
        $script:graphics.DrawPath($Stroke, $path)
    }
    finally {
        $path.Dispose()
    }
}

function Get-X([int]$index) {
    return $plotLeft + $index * (($plotRight - $plotLeft) / ($years.Count - 1))
}

function Get-Y([int]$rank) {
    if (-not $rankLaneIndex.ContainsKey($rank)) {
        throw "Rank $rank is not present in the displayed rank lanes."
    }
    return $plotTop + [int]$rankLaneIndex[$rank] * $laneSpacing
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
    $graphics.Clear((Get-Color "#FFFFFF"))

    $fonts.Title = [System.Drawing.Font]::new(
        "Segoe UI",
        70,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Subtitle = [System.Drawing.Font]::new(
        "Segoe UI",
        36,
        [System.Drawing.FontStyle]::Regular,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Section = [System.Drawing.Font]::new(
        "Segoe UI",
        64,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Axis = [System.Drawing.Font]::new(
        "Segoe UI",
        76,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Year = [System.Drawing.Font]::new(
        "Segoe UI",
        54,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Rank = [System.Drawing.Font]::new(
        "Segoe UI",
        48,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Label = [System.Drawing.Font]::new(
        "Segoe UI",
        58,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fonts.Note = [System.Drawing.Font]::new(
        "Segoe UI",
        25,
        [System.Drawing.FontStyle]::Regular,
        [System.Drawing.GraphicsUnit]::Pixel
    )

    $brushes.Ink = New-Brush "#142A41"
    $brushes.Muted = New-Brush "#52657A"
    $brushes.White = New-Brush "#FFFFFF"
    $brushes.Header = New-Brush "#E9F2F6"
    $brushes.Card = New-Brush "#FFFFFF"
    $brushes.TopFive = New-Brush "#F3F9F6"
    $pens.Border = New-Pen "#D8E2E9" 2
    $pens.Grid = New-Pen "#DCE6EC" 2
    $pens.Grid.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $pens.YearGrid = New-Pen "#E5ECF1" 2
    $pens.YearGrid.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dot

    Draw-Text $positionHeading 45 70 350 110 $fonts.Section $brushes.Ink "Center"
    Draw-Text $municipalityHeading $labelX 70 760 110 $fonts.Section $brushes.Ink

    foreach ($rank in $displayRanks) {
        $y = Get-Y $rank
        $graphics.DrawLine($pens.Grid, [single]$plotLeft, [single]$y, [single]$plotRight, [single]$y)
        Draw-Text "$rank$($unicode.Degree)" 90 ($y - 55) 255 110 $fonts.Axis $brushes.Muted "Right"
    }

    for ($yearOffset = 0; $yearOffset -lt $years.Count; $yearOffset++) {
        $yearValue = $years[$yearOffset]
        $x = Get-X $yearOffset
        $graphics.DrawLine(
            $pens.YearGrid,
            [single]$x,
            [single]$plotTop,
            [single]$x,
            [single]$plotBottom
        )
        Draw-Text "$yearValue" ($x - 120) $yearLabelY 240 100 $fonts.Year $brushes.Ink "Center"
    }

    for ($seriesIndex = 0; $seriesIndex -lt $series.Count; $seriesIndex++) {
        $seriesEntry = $series[$seriesIndex]
        $seriesName = [string]$seriesEntry.Name
        $positionsToPlot = @($seriesEntry.Positions)
        if ($positionsToPlot.Count -ne $years.Count) {
            throw "Incomplete series for ${seriesName}: expected $($years.Count) positions, found $($positionsToPlot.Count)."
        }
        $color = $palette[$seriesIndex]
        $linePen = New-Pen $color 14
        $markerFill = New-Brush $color
        $markerStroke = New-Pen "#FFFFFF" 5
        try {
            $points = [System.Drawing.PointF[]]::new($years.Count)
            for ($yearOffset = 0; $yearOffset -lt $years.Count; $yearOffset++) {
                $points[$yearOffset] = [System.Drawing.PointF]::new(
                    [single](Get-X $yearOffset),
                    [single](Get-Y ([int]$positionsToPlot[$yearOffset]))
                )
            }
            $graphics.DrawLines($linePen, $points)

            for ($yearOffset = 0; $yearOffset -lt $years.Count; $yearOffset++) {
                $x = Get-X $yearOffset
                $rankValue = [int]$positionsToPlot[$yearOffset]
                $y = Get-Y $rankValue
                $markerDiameter = 92.0
                $graphics.FillEllipse(
                    $markerFill,
                    [single]($x - $markerDiameter / 2),
                    [single]($y - $markerDiameter / 2),
                    [single]$markerDiameter,
                    [single]$markerDiameter
                )
                $graphics.DrawEllipse(
                    $markerStroke,
                    [single]($x - $markerDiameter / 2),
                    [single]($y - $markerDiameter / 2),
                    [single]$markerDiameter,
                    [single]$markerDiameter
                )
                Draw-Text "$rankValue$($unicode.Degree)" ($x - 50) ($y - 46) 100 92 $fonts.Rank $brushes.White "Center"
            }

            $finalY = Get-Y ([int]$positionsToPlot[$years.Count - 1])
            $graphics.DrawLine(
                $linePen,
                [single]($plotRight + 55),
                [single]$finalY,
                [single]($labelX - 35),
                [single]$finalY
            )
            Draw-Text $seriesName $labelX ($finalY - 50) 760 100 $fonts.Label $markerFill
        }
        finally {
            $linePen.Dispose()
            $markerFill.Dispose()
            $markerStroke.Dispose()
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
        MaximumRank = $maximumRank
        DisplayedRankLanes = $displayRanks.Count
        LaneSpacing = $laneSpacing
        BubbleOuterDiameter = 97
    } | Format-List
}
finally {
    $image.Dispose()
}
