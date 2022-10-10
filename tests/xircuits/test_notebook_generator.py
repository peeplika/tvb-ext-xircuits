import os.path
import shutil

from xircuits.nb_generator import NOTEBOOKS_DIR, NotebookGenerator, WidgetCodeGenerator


def test_notebook_generator():
    notebook_generator = NotebookGenerator()
    assert os.path.exists(NOTEBOOKS_DIR)
    assert notebook_generator.notebook is not None
    assert len(notebook_generator.notebook['cells']) == 0

    notebook_generator.add_code_cell("print('Hello world')")
    assert len(notebook_generator.notebook['cells']) == 1

    notebook_generator.add_markdown_cell("Hello world")
    assert len(notebook_generator.notebook['cells']) == 2

    assert len(os.listdir(NOTEBOOKS_DIR)) == 0
    notebook_path = notebook_generator.store('model', 'xircuits_id')
    assert os.path.exists(notebook_path)


def test_widget_code_generator():
    widget_code_generator = WidgetCodeGenerator()
    code = widget_code_generator.get_widget_code('Simulator', 'sim_id', 'xai_components/xai_tvb_simulator/simulator.py')
    assert code is None

    code = widget_code_generator.get_widget_code('ReducedWongWang', 'model_id',
                                                 'xai_components/xai_tvb_models/wong_wang.py')
    assert code is not None
    assert "models.ReducedWongWang()" in code
    assert "w.export_filename = 'model_model_id'" in code


def teardown_module():
    shutil.rmtree(NOTEBOOKS_DIR)