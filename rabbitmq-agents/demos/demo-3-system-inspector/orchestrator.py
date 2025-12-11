#!/usr/bin/env python3
"""
SYSTEM INSPECTOR ORCHESTRATOR
=============================
Ana giriş noktası - Tüm pipeline'ı tek komutla çalıştırır.

Usage:
    python orchestrator.py              # Tüm workflow'u çalıştır
    python orchestrator.py --task X     # Sadece X task'ını çalıştır
    python orchestrator.py --dry-run    # Sadece planı göster
    python orchestrator.py --list       # Task listesini göster

Efendim, yeni bir Claude session açıldığında bu script çalıştırılır.
"""

import argparse
import importlib
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# YAML desteği (opsiyonel - yoksa JSON fallback)
try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

# Base directory
BASE_DIR = Path(__file__).parent.absolute()
sys.path.insert(0, str(BASE_DIR))


class PipelineOrchestrator:
    """
    Pipeline Orchestrator - Task'ları sırayla çalıştırır

    Features:
        - YAML/JSON config driven
        - Task chaining (output → input)
        - Error handling
        - Report generation
    """

    def __init__(self, config_path: str = None):
        self.config_path = config_path or str(BASE_DIR / "config" / "workflow.yaml")
        self.config: Dict = {}
        self.context: Dict[str, Any] = {}  # Shared context between tasks
        self.results: List[Dict] = []
        self.start_time: Optional[datetime] = None

    def load_config(self) -> bool:
        """Workflow config'i yükle"""
        config_file = Path(self.config_path)

        if not config_file.exists():
            print(f"❌ Config file not found: {self.config_path}")
            return False

        try:
            with open(config_file, 'r') as f:
                if config_file.suffix in ['.yaml', '.yml'] and HAS_YAML:
                    self.config = yaml.safe_load(f)
                else:
                    self.config = json.load(f)

            print(f"✅ Loaded config: {config_file.name}")
            return True

        except Exception as e:
            print(f"❌ Error loading config: {e}")
            return False

    def get_task_class(self, module_name: str, class_name: str):
        """Task sınıfını dinamik olarak yükle"""
        try:
            module = importlib.import_module(module_name)
            return getattr(module, class_name)
        except (ImportError, AttributeError) as e:
            print(f"❌ Cannot load task {class_name} from {module_name}: {e}")
            return None

    def run_pipeline(self, specific_task: str = None) -> bool:
        """
        Tüm pipeline'ı çalıştır

        Args:
            specific_task: Sadece bu task'ı çalıştır (None = hepsi)

        Returns:
            bool: Pipeline başarılı mı
        """
        self.start_time = datetime.now()

        print("\n" + "=" * 70)
        print("🚀 SYSTEM INSPECTOR PIPELINE")
        print("=" * 70)
        print(f"📋 Workflow: {self.config.get('name', 'unnamed')}")
        print(f"📌 Version: {self.config.get('version', '1.0.0')}")
        print(f"⏰ Started: {self.start_time.isoformat()}")
        print("=" * 70)

        tasks = self.config.get('tasks', [])
        settings = self.config.get('settings', {})
        stop_on_error = settings.get('stop_on_error', False)

        success_count = 0
        fail_count = 0

        for task_config in tasks:
            task_name = task_config.get('name')
            enabled = task_config.get('enabled', True)

            # Specific task filtresi - belirtilmişse sadece onu çalıştır
            if specific_task:
                if task_name != specific_task:
                    continue
                # Specific task istendi, enabled durumuna bakma
            else:
                # Normal pipeline - disabled task'ı atla
                if not enabled:
                    print(f"\n⏭️  Skipping disabled task: {task_name}")
                    continue

            # Task sınıfını yükle
            module_name = task_config.get('module')
            class_name = task_config.get('class')
            task_config_data = task_config.get('config', {})

            TaskClass = self.get_task_class(module_name, class_name)
            if not TaskClass:
                fail_count += 1
                if stop_on_error:
                    break
                continue

            # Task instance'ı oluştur ve çalıştır
            task = TaskClass(config=task_config_data)
            result = task.run(context=self.context)

            # Result'ı kaydet
            self.results.append(result.to_dict())

            # Context'i güncelle (chaining için)
            if result.data:
                self.context.update(result.data)

            # Başarı/hata say
            if result.status.value == 'success':
                success_count += 1
            else:
                fail_count += 1
                if stop_on_error:
                    print(f"\n🛑 Stopping pipeline due to error in {task_name}")
                    break

        # Pipeline özeti
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()

        print("\n" + "=" * 70)
        print("📊 PIPELINE SUMMARY")
        print("=" * 70)
        print(f"   ✅ Successful tasks: {success_count}")
        print(f"   ❌ Failed tasks: {fail_count}")
        print(f"   ⏱️  Total duration: {duration:.2f}s")
        print("=" * 70)

        # Rapor kaydet
        if settings.get('save_report', True):
            self._save_report()

        return fail_count == 0

    def _save_report(self):
        """Pipeline raporunu kaydet"""
        report_dir = BASE_DIR / self.config.get('settings', {}).get('report_dir', 'reports')
        report_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = report_dir / f"pipeline_report_{timestamp}.json"

        report = {
            'workflow': self.config.get('name'),
            'version': self.config.get('version'),
            'started_at': self.start_time.isoformat() if self.start_time else None,
            'completed_at': datetime.now().isoformat(),
            'tasks': self.results,
            'final_context': self.context
        }

        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=str)

        print(f"\n💾 Report saved: {report_file.name}")

    def load_context_from_report(self) -> bool:
        """
        En son rapordan context yukle (task_final icin)

        Returns:
            bool: Context yuklendi mi
        """
        report_dir = BASE_DIR / self.config.get('settings', {}).get('report_dir', 'reports')

        if not report_dir.exists():
            return False

        # En son raporu bul (WORKED veya timestamp'e gore)
        reports = list(report_dir.glob('pipeline_report_*.json'))

        if not reports:
            return False

        # En yeni raporu sec (timestamp'e gore) - yeni acilan terminallerin ID'leri icin
        # WORKED raporu sadece baska rapor yoksa kullanilir
        non_worked_reports = [r for r in reports if 'WORKED' not in r.name]
        if non_worked_reports:
            latest_report = max(non_worked_reports, key=lambda p: p.stat().st_mtime)
        else:
            # Sadece WORKED varsa onu kullan
            latest_report = max(reports, key=lambda p: p.stat().st_mtime)

        try:
            with open(latest_report, 'r') as f:
                report_data = json.load(f)

            # final_context'i yukle
            final_context = report_data.get('final_context', {})

            if final_context:
                self.context = final_context
                print(f"   📂 Loaded from: {latest_report.name}")
                print(f"   🔑 Context keys: {list(final_context.keys())}")

                # Window ID'leri goster
                if 'terminals' in final_context:
                    terminals = final_context['terminals']
                    for t in terminals:
                        print(f"      {t.get('title')}: Window ID {t.get('window_id')}")

                return True

        except Exception as e:
            print(f"   ❌ Error loading report: {e}")

        return False

    def list_tasks(self):
        """Mevcut task'ları listele"""
        print("\n📋 Available Tasks:")
        print("-" * 50)

        for task in self.config.get('tasks', []):
            status = "✅" if task.get('enabled', True) else "⏭️"
            print(f"   {status} {task.get('name')}: {task.get('description', 'No description')}")

        print("-" * 50)

    def dry_run(self):
        """Pipeline'ı simüle et (çalıştırmadan)"""
        print("\n🔍 DRY RUN - Pipeline Plan:")
        print("-" * 50)

        for i, task in enumerate(self.config.get('tasks', []), 1):
            if task.get('enabled', True):
                depends = task.get('depends_on', 'none')
                print(f"   {i}. {task.get('name')}")
                print(f"      └─ Module: {task.get('module')}")
                print(f"      └─ Depends on: {depends}")

        print("-" * 50)
        print("   Run without --dry-run to execute pipeline")


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description='System Inspector Pipeline Orchestrator',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
    python orchestrator.py                  # Run full pipeline
    python orchestrator.py --task terminal_setup   # Run specific task
    python orchestrator.py --list           # List available tasks
    python orchestrator.py --dry-run        # Show execution plan
    python orchestrator.py --task task_final --load-context  # Safe shutdown (load Window IDs from last report)
        '''
    )

    parser.add_argument('--config', '-c', help='Config file path')
    parser.add_argument('--task', '-t', help='Run specific task only')
    parser.add_argument('--list', '-l', action='store_true', help='List available tasks')
    parser.add_argument('--dry-run', '-d', action='store_true', help='Show plan without executing')
    parser.add_argument('--load-context', action='store_true',
                        help='Load context from last report (for task_final)')

    args = parser.parse_args()

    # Orchestrator oluştur
    orchestrator = PipelineOrchestrator(config_path=args.config)

    # Config yükle
    if not orchestrator.load_config():
        sys.exit(1)

    # Load context from last report if requested
    if args.load_context:
        if orchestrator.load_context_from_report():
            print("✅ Context loaded from last report")
        else:
            print("⚠️  No previous report found, starting with empty context")

    # İşlem seç
    if args.list:
        orchestrator.list_tasks()
    elif args.dry_run:
        orchestrator.dry_run()
    else:
        success = orchestrator.run_pipeline(specific_task=args.task)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
