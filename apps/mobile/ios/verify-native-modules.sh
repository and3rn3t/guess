#!/bin/bash

#
# verify-native-modules.sh
# Andernator
#
# Run this as a build phase script to verify all native modules are properly configured.
# Add to Xcode: Target → Build Phases → New Run Script Phase
# Shell: /bin/bash
# Script: ${PROJECT_DIR}/Andernator/Scripts/verify-native-modules.sh
#

set -e

echo "🔍 Verifying Native Services modules..."

PROJECT_ROOT="${PROJECT_DIR}/.."
NATIVE_SERVICES_DIR="${PROJECT_DIR}/Andernator/NativeServices"

# Check if NativeServices directory exists
if [ ! -d "$NATIVE_SERVICES_DIR" ]; then
    echo "⚠️  Warning: NativeServices directory not found at ${NATIVE_SERVICES_DIR}"
    exit 0
fi

# Expected Swift files
EXPECTED_FILES=(
    "BridgeContract.swift"
    "HapticsService.swift"
    "VoiceOverAnnouncer.swift"
    "ReduceMotionObserver.swift"
    "LifecycleObserver.swift"
)

MISSING_FILES=()

# Check each expected file
for file in "${EXPECTED_FILES[@]}"; do
    if [ ! -f "$NATIVE_SERVICES_DIR/$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

# Report results
if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    echo "✅ All native service files present (${#EXPECTED_FILES[@]}/${#EXPECTED_FILES[@]})"
else
    echo "⚠️  Missing files (${#MISSING_FILES[@]}):"
    for file in "${MISSING_FILES[@]}"; do
        echo "   - $file"
    done
    echo ""
    echo "💡 Tip: Make sure all Swift files are added to the Xcode project with Andernator target membership."
fi

# Check bridging header
BRIDGING_HEADER="${PROJECT_DIR}/Andernator/Andernator-Bridging-Header.h"
if [ -f "$BRIDGING_HEADER" ]; then
    echo "✅ Bridging header found"
    
    # Verify required imports
    if ! grep -q "RCTBridgeModule" "$BRIDGING_HEADER"; then
        echo "⚠️  Warning: Bridging header missing RCTBridgeModule import"
    fi
    if ! grep -q "RCTEventEmitter" "$BRIDGING_HEADER"; then
        echo "⚠️  Warning: Bridging header missing RCTEventEmitter import"
    fi
else
    echo "⚠️  Warning: Bridging header not found at ${BRIDGING_HEADER}"
    echo "💡 Configure in Build Settings: Objective-C Bridging Header → Andernator/Andernator-Bridging-Header.h"
fi

echo "✨ Native modules verification complete"
