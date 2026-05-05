#!/bin/bash

#
# organize-native-services.sh
# 
# Organizes all native services files into correct project locations.
# Run this from the repository root.
#
# Usage:
#   chmod +x organize-native-services.sh
#   ./organize-native-services.sh
#

set -e

echo "🗂️  Organizing Native Services Files..."
echo ""

# Define base directories
PROJECT_ROOT="$(pwd)"
IOS_DIR="apps/mobile/ios/Andernator"
SRC_DIR="apps/mobile/src/native"
DOCS_DIR="docs/mobile"

# Create directories if they don't exist
echo "📁 Creating directories..."
mkdir -p "${IOS_DIR}/NativeServices"
mkdir -p "${IOS_DIR}/Scripts"
mkdir -p "${SRC_DIR}"
mkdir -p "${DOCS_DIR}"

# Track moved files
MOVED=0
SKIPPED=0

# Function to move file
move_file() {
    local src="$1"
    local dest="$2"
    local desc="$3"
    
    if [ -f "$src" ]; then
        echo "  ✓ Moving $desc..."
        mv "$src" "$dest"
        ((MOVED++))
    else
        echo "  ⚠ Skipping $desc (not found)"
        ((SKIPPED++))
    fi
}

# Move Swift files
echo ""
echo "🔷 Moving Swift files to ${IOS_DIR}/NativeServices/..."
move_file "BridgeContract.swift" "${IOS_DIR}/NativeServices/" "BridgeContract.swift"
move_file "HapticsService.swift" "${IOS_DIR}/NativeServices/" "HapticsService.swift"
move_file "VoiceOverAnnouncer.swift" "${IOS_DIR}/NativeServices/" "VoiceOverAnnouncer.swift"
move_file "ReduceMotionObserver.swift" "${IOS_DIR}/NativeServices/" "ReduceMotionObserver.swift"
move_file "LifecycleObserver.swift" "${IOS_DIR}/NativeServices/" "LifecycleObserver.swift"

# Move Xcode configuration files
echo ""
echo "⚙️  Moving Xcode configuration files..."
move_file "Andernator-Bridging-Header.h" "${IOS_DIR}/" "Bridging Header"
move_file "NativeServices-Swift-Interface.h" "${IOS_DIR}/" "Swift Interface Header"
move_file "verify-native-modules.sh" "${IOS_DIR}/Scripts/" "Verification Script"

# Make verification script executable
if [ -f "${IOS_DIR}/Scripts/verify-native-modules.sh" ]; then
    chmod +x "${IOS_DIR}/Scripts/verify-native-modules.sh"
    echo "  ✓ Made verification script executable"
fi

# Move TypeScript files
echo ""
echo "📘 Moving TypeScript files to ${SRC_DIR}/..."
move_file "NativeServices.ts" "${SRC_DIR}/" "NativeServices.ts"
move_file "useNativeServices.ts" "${SRC_DIR}/" "useNativeServices.ts"
move_file "NativeServicesExamples.tsx" "${SRC_DIR}/" "NativeServicesExamples.tsx"
move_file "testNativeModules.ts" "${SRC_DIR}/" "testNativeModules.ts"
move_file "NativeServicesDebugMenu.tsx" "${SRC_DIR}/" "NativeServicesDebugMenu.tsx"

# Move and rename documentation files
echo ""
echo "📚 Moving documentation files to ${SRC_DIR}/..."
if [ -f "NativeServices-README.md" ]; then
    echo "  ✓ Moving NativeServices README..."
    mv "NativeServices-README.md" "${SRC_DIR}/README.md"
    ((MOVED++))
else
    echo "  ⚠ Skipping NativeServices README (not found)"
    ((SKIPPED++))
fi

if [ -f "NATIVE_SERVICES_QUICK_REF.md" ]; then
    echo "  ✓ Moving Quick Reference..."
    mv "NATIVE_SERVICES_QUICK_REF.md" "${SRC_DIR}/QUICK_REFERENCE.md"
    ((MOVED++))
else
    echo "  ⚠ Skipping Quick Reference (not found)"
    ((SKIPPED++))
fi

# Move Xcode documentation
echo ""
echo "📖 Moving Xcode documentation to ${DOCS_DIR}/..."
move_file "XCODE_IMPLEMENTATION_HANDOFF.md" "${DOCS_DIR}/" "Implementation Handoff"
move_file "XCODE_PROJECT_INTEGRATION.md" "${DOCS_DIR}/" "Project Integration Guide"
move_file "XCODE_BUILD_SETTINGS.md" "${DOCS_DIR}/" "Build Settings Guide"
move_file "XCODE_SCHEME_CONFIG.md" "${DOCS_DIR}/" "Scheme Configuration"
move_file "INFO_PLIST_CONFIG.md" "${DOCS_DIR}/" "Info.plist Configuration"
move_file "IMPLEMENTATION_STATUS.md" "${DOCS_DIR}/" "Implementation Status"
move_file "FILE_INDEX.md" "${DOCS_DIR}/" "File Index"

# Summary
echo ""
echo "✨ Organization Complete!"
echo ""
echo "📊 Summary:"
echo "  ✓ Files moved: $MOVED"
echo "  ⚠ Files skipped: $SKIPPED"
echo ""

# Show directory structure
echo "📁 Directory Structure:"
echo ""
echo "Swift Modules:"
ls -1 "${IOS_DIR}/NativeServices/" 2>/dev/null || echo "  (directory not found or empty)"
echo ""
echo "TypeScript Integration:"
ls -1 "${SRC_DIR}/" 2>/dev/null || echo "  (directory not found or empty)"
echo ""
echo "Documentation:"
ls -1 "${DOCS_DIR}/" | grep -E "(XCODE|IMPLEMENTATION|INFO_PLIST|FILE_INDEX)" 2>/dev/null || echo "  (no matching files)"
echo ""

# Next steps
echo "🎯 Next Steps:"
echo ""
echo "1. Open Xcode:"
echo "   pnpm mobile:open:xcode"
echo ""
echo "2. Add Swift files to project:"
echo "   - Right-click Andernator → Add Files..."
echo "   - Select NativeServices folder"
echo "   - Check 'Create groups' and 'Andernator' target"
echo ""
echo "3. Configure bridging header:"
echo "   - Build Settings → Objective-C Bridging Header"
echo "   - Set to: Andernator/Andernator-Bridging-Header.h"
echo ""
echo "4. Build the project:"
echo "   - Product → Build (Cmd+B)"
echo ""
echo "5. Run validation:"
echo "   pnpm validate:fast"
echo ""
echo "📚 See ${DOCS_DIR}/XCODE_PROJECT_INTEGRATION.md for detailed instructions"
echo ""
