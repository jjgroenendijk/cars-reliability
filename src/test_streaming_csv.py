#!/usr/bin/env python3
"""
Test the CSVWriter to verify it correctly writes CSV files.

Tests:
1. Basic write functionality
2. Thread-safe concurrent writes
3. Immediate disk flush (fsync)
4. Row counting accuracy
"""

import os
import sys
import tempfile
import threading
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from download import CSVWriter, log


def test_basic_write():
    """Test basic CSV writing."""
    log("Test 1: Basic write functionality...")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        temp_path = Path(f.name)
    
    try:
        rows = [
            {"kenteken": "AB123C", "merk": "Toyota", "model": "Corolla"},
            {"kenteken": "DE456F", "merk": "Honda", "model": "Civic"},
            {"kenteken": "GH789I", "merk": "Ford", "model": "Focus"},
        ]
        
        with CSVWriter(temp_path) as writer:
            writer.rows_write(rows)
            assert writer.row_count == 3, f"Expected row_count 3, got {writer.row_count}"
        
        # Verify file contents
        with open(temp_path, 'r') as f:
            lines = f.readlines()
        
        assert len(lines) == 4, f"Expected 4 lines (header + 3 rows), got {len(lines)}"
        assert "kenteken,merk,model" in lines[0], f"Header mismatch: {lines[0]}"
        assert "AB123C,Toyota,Corolla" in lines[1], f"Row 1 mismatch: {lines[1]}"
        
        log("  PASS: Basic write works correctly")
        return True
    
    finally:
        temp_path.unlink(missing_ok=True)


def test_concurrent_writes():
    """Test thread-safe concurrent writing."""
    log("Test 2: Concurrent writes...")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        temp_path = Path(f.name)
    
    try:
        num_threads = 10
        rows_per_thread = 100
        
        def write_batch(writer, thread_id):
            rows = [
                {"thread": str(thread_id), "row": str(i), "data": f"value_{thread_id}_{i}"}
                for i in range(rows_per_thread)
            ]
            writer.rows_write(rows)
        
        with CSVWriter(temp_path) as writer:
            threads = []
            for i in range(num_threads):
                t = threading.Thread(target=write_batch, args=(writer, i))
                threads.append(t)
                t.start()
            
            for t in threads:
                t.join()
            
            expected_total = num_threads * rows_per_thread
            assert writer.row_count == expected_total, \
                f"Expected {expected_total} rows, got {writer.row_count}"
        
        # Verify file has correct number of rows
        with open(temp_path, 'r') as f:
            lines = f.readlines()
        
        # Should be header + (num_threads * rows_per_thread)
        expected_lines = 1 + num_threads * rows_per_thread
        assert len(lines) == expected_lines, \
            f"Expected {expected_lines} lines, got {len(lines)}"
        
        log(f"  PASS: {num_threads} threads wrote {expected_total} rows correctly")
        return True
    
    finally:
        temp_path.unlink(missing_ok=True)


def test_disk_flush():
    """Test that data is flushed to disk immediately."""
    log("Test 3: Immediate disk flush...")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        temp_path = Path(f.name)
    
    try:
        with CSVWriter(temp_path) as writer:
            # Write first batch
            writer.rows_write([{"col": "val1"}])
            
            # Check file size - should have header + 1 row
            size_after_first = os.path.getsize(temp_path)
            assert size_after_first > 0, "File should have content after first write"
            
            # Write second batch
            writer.rows_write([{"col": "val2"}])
            
            # File should be larger
            size_after_second = os.path.getsize(temp_path)
            assert size_after_second > size_after_first, \
                "File should grow after second write (fsync working)"
        
        log("  PASS: Data is flushed to disk immediately")
        return True
    
    finally:
        temp_path.unlink(missing_ok=True)


def test_empty_rows():
    """Test handling of empty row lists."""
    log("Test 4: Empty rows handling...")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        temp_path = Path(f.name)
    
    try:
        with CSVWriter(temp_path) as writer:
            writer.rows_write([])
            assert writer.row_count == 0, f"Expected 0 rows for empty list"
            
            # Write some actual data
            writer.rows_write([{"col": "val"}])
            
            # Write empty again
            writer.rows_write([])
            
            assert writer.row_count == 1, f"Total should be 1, got {writer.row_count}"
        
        log("  PASS: Empty rows handled correctly")
        return True
    
    finally:
        temp_path.unlink(missing_ok=True)


def main():
    """Run all tests."""
    log("\n" + "="*60)
    log("CSV WRITER TESTS")
    log("="*60 + "\n")
    
    tests = [
        test_basic_write,
        test_concurrent_writes,
        test_disk_flush,
        test_empty_rows,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
                log(f"  FAIL: {test.__name__}")
        except Exception as e:
            failed += 1
            log(f"  FAIL: {test.__name__}: {e}")
    
    log("\n" + "="*60)
    log(f"RESULTS: {passed} passed, {failed} failed")
    log("="*60 + "\n")
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
