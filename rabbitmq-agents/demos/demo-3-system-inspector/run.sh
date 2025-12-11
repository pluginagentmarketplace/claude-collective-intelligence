#!/bin/bash
# =============================================================================
# SYSTEM INSPECTOR - FULL AUTO RUN SCRIPT v5.1.0
# =============================================================================
# Kullanim:
#   ./run.sh           # Baslat (Task 1-5)
#   ./run.sh shutdown  # Guvenli kapat (Task Final)
#   ./run.sh --help    # Yardim
# =============================================================================

set -e  # Hata durumunda dur

# Script'in bulunduğu dizine git
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# PyYAML kontrol et ve gerekirse yükle
if ! python3 -c "import yaml" 2>/dev/null; then
    echo "Installing PyYAML..."
    pip3 install PyYAML -q
fi

# Komut kontrol
case "${1:-start}" in
    shutdown|stop|close)
        echo "========================================"
        echo "  SYSTEM INSPECTOR - SAFE SHUTDOWN"
        echo "========================================"
        echo "Directory: $SCRIPT_DIR"
        echo ""
        python3 orchestrator.py --task task_final --load-context
        echo ""
        echo "Shutdown complete!"
        ;;
    start|"")
        echo "========================================"
        echo "  SYSTEM INSPECTOR - PIPELINE START"
        echo "========================================"
        echo "Directory: $SCRIPT_DIR"
        echo ""
        python3 orchestrator.py
        echo ""
        echo "Pipeline complete!"
        echo ""
        echo "To shutdown: ./run.sh shutdown"
        ;;
    --help|-h)
        echo "System Inspector Pipeline v5.1.0"
        echo ""
        echo "Usage:"
        echo "  ./run.sh           Start pipeline (Task 1-5)"
        echo "  ./run.sh shutdown  Safe shutdown (Task Final)"
        echo "  ./run.sh stop      Same as shutdown"
        echo "  ./run.sh --help    Show this help"
        echo ""
        echo "Pipeline Tasks:"
        echo "  Task 1: Display Inspector"
        echo "  Task 2: Terminal Setup (Window ID capture)"
        echo "  Task 3: Screenshot Validator"
        echo "  Task 4: Claude Launcher"
        echo "  Task 5: Role Prompter"
        echo "  Task Final: Safe Shutdown (/exit + close)"
        ;;
    *)
        # Diger argumanlar direkt orchestrator'a gonder
        python3 orchestrator.py "$@"
        ;;
esac
